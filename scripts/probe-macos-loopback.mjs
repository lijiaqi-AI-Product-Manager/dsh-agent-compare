// Feasibility only: no application data, credentials, aliases or system edits.
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
assert.equal(process.platform, 'darwin')
const output = path.resolve(process.env.AGENT_COMPARE_UI_ARTIFACTS ?? '.runtime-checks/safari-evidence')
await mkdir(output, { recursive: true })
const file = path.join(output, 'loopback-probe.c'), binary = path.join(output, 'loopback-probe')
const source = `#include <arpa/inet.h>
#include <errno.h>
#include <net/if.h>
#include <netinet/in.h>
#include <poll.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>
int main(void) {
  int fd=socket(AF_INET,SOCK_STREAM,0), index=(int)if_nametoindex("lo0"), pinned=0;
  socklen_t length=sizeof(pinned);
  if(fd<0 || index<=0 || setsockopt(fd,IPPROTO_IP,IP_BOUND_IF,&index,sizeof(index)) || getsockopt(fd,IPPROTO_IP,IP_BOUND_IF,&pinned,&length) || pinned!=index)return 2;
  struct sockaddr_in address={0};address.sin_len=sizeof(address);address.sin_family=AF_INET;inet_pton(AF_INET,"127.87.44.19",&address.sin_addr);
  int direct=bind(fd,(struct sockaddr*)&address,sizeof(address))==0;
  if(!direct){address.sin_addr.s_addr=INADDR_ANY;if(bind(fd,(struct sockaddr*)&address,sizeof(address)))return 3;}
  if(listen(fd,8))return 4;
  length=sizeof(address);if(getsockname(fd,(struct sockaddr*)&address,&length))return 5;
  printf("{\\"port\\":%u,\\"directBind\\":%s,\\"interfacePinned\\":true}\\n",ntohs(address.sin_port),direct?"true":"false");fflush(stdout);
  for(int i=0;i<8;i++){
    struct pollfd wait={fd,POLLIN,0};if(poll(&wait,1,1000)<=0)continue;
    struct sockaddr_in peer={0},local={0};length=sizeof(peer);int client=accept(fd,(struct sockaddr*)&peer,&length);if(client<0)continue;
    length=sizeof(local);if(getsockname(client,(struct sockaddr*)&local,&length)==0 && ntohl(local.sin_addr.s_addr)==0x7f572c13 && (ntohl(peer.sin_addr.s_addr)>>24)==127){
      const char body[]="HTTP/1.1 200 OK\\r\\nContent-Length: 14\\r\\nConnection: close\\r\\n\\r\\nowned-loopback";send(client,body,sizeof(body)-1,0);
    }
    close(client);
  }
  close(fd);return 0;
}`
await writeFile(file, source)
execFileSync('/usr/bin/cc', [file, '-O2', '-Wall', '-Werror', '-o', binary], { stdio: 'pipe' })
const child = spawn(binary, [], { stdio: ['ignore', 'pipe', 'pipe'] })
let stdout='', stderr=''
child.stdout.setEncoding('utf8').on('data', chunk=>{stdout+=chunk})
child.stderr.setEncoding('utf8').on('data', chunk=>{stderr+=chunk})
const end=Date.now()+10000
try {
  while(!stdout.includes('\n')&&Date.now()<end&&child.exitCode===null)await new Promise(resolve=>setTimeout(resolve,25))
  assert.ok(stdout.includes('\n'), 'Loopback probe did not start: '+stderr)
  const startup=JSON.parse(stdout.split('\n')[0]), attempts=[]
  const targets=[['allocated','127.87.44.19'],['other-loopback','127.0.0.1']]
  const lan=Object.values(os.networkInterfaces()).flat().find(row=>row&&row.family==='IPv4'&&!row.internal)
  if(lan)targets.push(['non-loopback',lan.address])
  for(const [kind,host]of targets){try{const response=await fetch('http://'+host+':'+startup.port+'/',{signal:AbortSignal.timeout(1500)});attempts.push({kind,status:response.status,body:await response.text()})}catch(error){attempts.push({kind,unavailable:true,code:error.cause?.code??error.name})}}
  const result={platform:process.platform,macOS:execFileSync('/usr/bin/sw_vers',['-productVersion'],{encoding:'utf8'}).trim(),node:process.version,...startup,attempts,noPrivilegeRequested:true,noSystemConfigurationChanged:true}
  await writeFile(path.join(output,'loopback-probe.json'),JSON.stringify(result,null,2))
  console.log(JSON.stringify(result))
} finally {if(child.exitCode===null)child.kill('SIGTERM')}
