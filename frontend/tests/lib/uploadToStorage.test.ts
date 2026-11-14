import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isUploadCancelled, uploadToStorage } from '@/lib/uploadToStorage';

type ProgressListener = (event: {
  lengthComputable: boolean;
  loaded: number;
  total: number;
}) => void;

/** Just enough of XMLHttpRequest to drive an upload by hand and see what happened to it. */
class FakeXhr {
  static last: FakeXhr | null = null;
  status = 0;
  sent = false;
  aborted = false;
  private readonly listeners = new Map<string, () => void>();
  readonly upload: {
    progressListener: ProgressListener | null;
    addEventListener(type: 'progress', listener: ProgressListener): void;
  } = {
    progressListener: null,
    addEventListener(_type, listener) {
      this.progressListener = listener;
    },
  };

  constructor() {
    FakeXhr.last = this;
  }
  open() {}
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener);
  }
  send() {
    this.sent = true;
  }
  abort() {
    this.aborted = true;
    this.listeners.get('abort')?.();
  }
  /** Simulates the server answering. */
  respond(status: number) {
    this.status = status;
    this.listeners.get('load')?.();
  }
}

const permission = { url: 'http://storage.test/bucket', fields: { key: 'pending/a/b.jpg' } };
const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  FakeXhr.last = null;
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadToStorage', () => {
  it('reports progress and resolves when storage accepts the file', async () => {
    const progress: number[] = [];
    const done = uploadToStorage(permission, file, (percent) => progress.push(percent));

    FakeXhr.last!.upload.progressListener!({ lengthComputable: true, loaded: 1, total: 4 });
    FakeXhr.last!.respond(204);

    await expect(done).resolves.toBeUndefined();
    expect(progress).toEqual([25]);
  });

  it('rejects with a readable message when storage refuses the file', async () => {
    const done = uploadToStorage(permission, file, () => {});
    FakeXhr.last!.respond(403);

    await expect(done).rejects.toThrow('Check its size and type');
  });

  it('stops the request when the signal is aborted, and reports it as a cancellation', async () => {
    const controller = new AbortController();
    const done = uploadToStorage(permission, file, () => {}, controller.signal);

    controller.abort();

    const err = await done.catch((error: unknown) => error);
    expect(FakeXhr.last!.aborted).toBe(true);
    expect(isUploadCancelled(err)).toBe(true);
  });

  it('does not start at all when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const err = await uploadToStorage(permission, file, () => {}, controller.signal).catch(
      (error: unknown) => error,
    );

    expect(FakeXhr.last).toBeNull();
    expect(isUploadCancelled(err)).toBe(true);
  });

  it('does not treat an ordinary failure as a cancellation', async () => {
    const done = uploadToStorage(permission, file, () => {});
    FakeXhr.last!.respond(500);

    expect(isUploadCancelled(await done.catch((error: unknown) => error))).toBe(false);
  });
});
