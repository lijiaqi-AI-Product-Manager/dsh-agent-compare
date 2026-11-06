// Launch the actual installed application through Launch Services. AppKit
// observes readiness without requesting Apple Events or changing permissions.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

export function launchHostedSafari() {
  assert.equal(process.platform, 'darwin')
  assert.equal(process.env.GITHUB_ACTIONS, 'true')
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted')
  execFileSync('/usr/bin/open', ['-a', '/Applications/Safari.app', 'about:blank'], { timeout: 10000 })
  execFileSync('/usr/bin/swift', ['-e', `
import AppKit
import Foundation
let deadline = Date().addingTimeInterval(45)
while Date() < deadline {
    if NSWorkspace.shared.runningApplications.contains(where: { $0.bundleIdentifier == "com.apple.Safari" && $0.isFinishedLaunching && !$0.isTerminated }) {
        print("Installed Safari finished its normal application launch")
        exit(0)
    }
    Thread.sleep(forTimeInterval: 0.2)
}
fputs("Installed Safari did not finish launching\\n", stderr)
exit(1)
`], { stdio: 'inherit', timeout: 120000 })
}
