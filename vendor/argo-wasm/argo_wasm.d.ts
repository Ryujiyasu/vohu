/* tslint:disable */
/* eslint-disable */

/**
 * Ballot-validity statement (public inputs).
 */
export class ArgoBallot {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Construct a ballot-validity statement.
     *
     * `ciphertexts_json` must be a JSON array of byte arrays — e.g.
     * `"[[1,2],[3,4],[5,6]]"`. Length must equal `num_options`.
     *
     * Returns a JS error for zero options or ciphertext-count mismatch.
     */
    constructor(num_options: number, nullifier: Uint8Array, ciphertexts_json: string);
    /**
     * Serialize the statement's public inputs (backend-agnostic wire
     * format).
     */
    public_inputs(): Uint8Array;
    readonly kind: string;
    readonly num_options: number;
}

/**
 * The mock reference backend exposed to JS.
 */
export class ArgoMock {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    /**
     * Generate a mock proof for a ballot + witness.
     *
     * `randomness_json` must be a JSON array of byte arrays, matching
     * the ciphertext count.
     */
    prove(ballot: ArgoBallot, chosen: number, randomness_json: string, secret_key: Uint8Array): ArgoProof;
    /**
     * Verify a mock proof against a ballot. The proof must have been
     * produced by the mock backend for the same statement.
     */
    verify(ballot: ArgoBallot, proof: ArgoProof): boolean;
    readonly name: string;
}

/**
 * Opaque proof blob returned by a backend.
 */
export class ArgoProof {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly backend: string;
    readonly data: Uint8Array;
}

/**
 * Canonical argo version string, useful for probe pages that want to
 * confirm a specific build is loaded.
 */
export function argo_version(): string;

/**
 * The statement kind identifier this build is pinned to.
 */
export function ballot_validity_kind(): string;

export function start(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_argoballot_free: (a: number, b: number) => void;
    readonly __wbg_argomock_free: (a: number, b: number) => void;
    readonly __wbg_argoproof_free: (a: number, b: number) => void;
    readonly argo_version: () => [number, number];
    readonly argoballot_kind: (a: number) => [number, number];
    readonly argoballot_new: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly argoballot_num_options: (a: number) => number;
    readonly argoballot_public_inputs: (a: number) => [number, number];
    readonly argomock_name: (a: number) => [number, number];
    readonly argomock_prove: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly argomock_verify: (a: number, b: number, c: number) => [number, number, number];
    readonly argoproof_backend: (a: number) => [number, number];
    readonly argoproof_data: (a: number) => [number, number];
    readonly ballot_validity_kind: () => [number, number];
    readonly start: () => void;
    readonly argomock_new: () => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
