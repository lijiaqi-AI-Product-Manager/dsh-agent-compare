/**
 * The built-in case. Its requirements are explicit and the DOM contract is
 * stated, so the example repository's `.agent-compare.json` can check that
 * both versions actually deliver them, not only that they render.
 */
export declare const EXAMPLE_TASK: string;
/** The template shipped in the package: `<package>/examples/vite-react-demo`. */
export declare function exampleTemplateDir(): string;
/**
 * Create a fresh, committed example repository under `parent` (a new folder
 * each time; nothing existing is touched) and return its path.
 */
export declare function createExampleRepo(parent: string, template?: string): Promise<string>;
