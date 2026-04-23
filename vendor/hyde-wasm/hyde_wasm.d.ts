/* tslint:disable */
/* eslint-disable */

/**
 * High-level Hyde API for browsers.
 *
 * Each instance owns a fresh `SoftwareBackend` and a fresh PQC keypair. Data
 * protected by one instance can only be unprotected by the same instance —
 * there is no cross-session persistence in this minimal build.
 */
export class HydeWasm {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Construct a new Hyde instance with a software backend.
     */
    constructor();
    /**
     * Protect `data` and return a JSON-serialized `ProtectedData` blob.
     *
     * Callers should treat the returned bytes as opaque. The blob includes
     * both the PQC layer (ML-KEM-768 + AES-GCM) and the software seal layer.
     */
    protect(data: Uint8Array): Uint8Array;
    /**
     * Unprotect a blob produced by `protect`.
     */
    unprotect(serialized: Uint8Array): Uint8Array;
}

/**
 * A serialized ML-KEM-768 keypair. Both keys are opaque byte blobs sized by
 * the spec (ek = 1184 bytes, dk = 2400 bytes for ML-KEM-768).
 */
export class PqcKeypairWasm {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Decapsulation (secret) key bytes. Callers must protect these —
     * anyone with these bytes can decrypt.
     */
    dkBytes(): Uint8Array;
    /**
     * Encapsulation (public) key bytes.
     */
    ekBytes(): Uint8Array;
    /**
     * Generate a fresh ML-KEM-768 keypair.
     */
    static generate(): PqcKeypairWasm;
}

/**
 * Decrypt a ciphertext produced by `pqcEncrypt`, using the secret key.
 */
export function pqcDecrypt(dk_bytes: Uint8Array, serialized_ct: Uint8Array): Uint8Array;

/**
 * Encrypt `data` with ML-KEM-768 + AES-256-GCM using the given public key.
 *
 * Returns a JSON-serialized `{ kemCt, ct }` blob.
 */
export function pqcEncrypt(ek_bytes: Uint8Array, data: Uint8Array): Uint8Array;

export function start(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_hydewasm_free: (a: number, b: number) => void;
    readonly __wbg_pqckeypairwasm_free: (a: number, b: number) => void;
    readonly hydewasm_new: () => [number, number, number];
    readonly hydewasm_protect: (a: number, b: number, c: number) => [number, number, number, number];
    readonly hydewasm_unprotect: (a: number, b: number, c: number) => [number, number, number, number];
    readonly pqcDecrypt: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly pqcEncrypt: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly pqckeypairwasm_dkBytes: (a: number) => [number, number];
    readonly pqckeypairwasm_ekBytes: (a: number) => [number, number];
    readonly pqckeypairwasm_generate: () => number;
    readonly start: () => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
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
