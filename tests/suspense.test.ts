import { from, Model, set } from '../src';
import { Oops } from '../src/suspense';
import { mockAsync, mockSuspense, timeout, ensure } from './adapter';

describe("empty", () => {
  it('will suspend if value is accessed before set', async () => {
    class Test extends Model {
      foobar = set<string>();
    }

    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("foobar");
      promise.resolve();
    })
  
    test.assertDidSuspend(true);

    instance.foobar = "foo!";

    // expect refresh caused by update
    await promise.await();

    test.assertDidRender(true);
  })

  it('will not suspend if value is defined', async () => {
    class Test extends Model {
      foobar = set<string>();
    }

    const test = mockSuspense();
    const instance = Test.create();

    instance.foobar = "foo!";

    test.renderHook(() => {
      instance.tap("foobar");
    })
  
    test.assertDidRender(true);
  })
})

describe("set async", () => {
  it('will auto-suspend if assessed value is async', async () => {
    class Test extends Model {
      value = set(promise.await);
    }

    const test = mockSuspense();
    const promise = mockAsync();
    const didRender = mockAsync();
    const instance = Test.create();

    test.renderHook(() => {
      void instance.tap().value;
      didRender.resolve();
    })
  
    test.assertDidSuspend(true);

    promise.resolve();
    await didRender.await();

    test.assertDidRender(true);
  })

  it("will seem to throw error outside react", () => {
    const promise = mockAsync();

    class Test extends Model {
      value = set(promise.await);
    }

    const instance = Test.create();
    const exprected = Oops.ValueNotReady(instance, "value");

    expect(() => instance.value).toThrowError(exprected);
    promise.resolve();
  })

  it('will refresh and throw if async rejects', async () => {
    const promise = mockAsync();

    class Test extends Model {
      value = set(async () => {
        await promise.await();
        throw "oh no";
      })
    }

    const test = mockSuspense();
    const instance = Test.create();
    const didThrow = mockAsync();

    test.renderHook(() => {
      try {
        void instance.tap().value;
      }
      catch(err: any){
        if(err instanceof Promise)
          throw err;
        else
          didThrow.resolve(err);
      }
    })

    test.assertDidSuspend(true);

    promise.resolve();

    const error = await didThrow.await();

    expect(error).toBe("oh no");
  })
  
  it('will bind async function to self', async () => {
    class Test extends Model {
      // methods lose implicit this
      value = set(this.method, false);

      async method(){
        expect(this).toStrictEqual(instance);
      }
    }

    const test = mockSuspense();
    const didRender = mockAsync();
    const instance = Test.create() as Test;

    test.renderHook(() => {
      void instance.tap().value;
      didRender.resolve();
    });

    await didRender.await();
  })
})

describe("nested set", () => {
  const greet = mockAsync<string>();
  const name = mockAsync<string>();
  
  class Mock extends Model {
    greet = set(greet.await);
    name = set(name.await);
  }

  it("will suspend a factory", async () => {
    const didEvaluate = jest.fn();

    class Test extends Mock {
      value = set(() => {
        didEvaluate();
        return this.greet + " " + this.name;
      });
    }
    
    const test = Test.create();
    const pending = ensure(() => test.value);

    greet.resolve("Hello");
    await timeout();
    name.resolve("World");

    const value = await pending;

    expect(value).toBe("Hello World");
    expect(didEvaluate).toBeCalledTimes(3);
  })

  it("will suspend async factory", async () => {
    const didEvaluate = jest.fn();

    class Test extends Mock {
      value = set(async () => {
        didEvaluate();
        return this.greet + " " + this.name;
      });
    }
    
    const test = Test.create();
    const pending = ensure(() => test.value);

    greet.resolve("Hello");
    await timeout();
    name.resolve("World");

    const value = await pending;

    expect(value).toBe("Hello World");
    expect(didEvaluate).toBeCalledTimes(3);
  })

  it("will not suspend if already resolved", async () => {
    class Test extends Model {
      greet = set(async () => "Hello");
      name = set(async () => "World");

      value = set(() => {
        return this.greet + " " + this.name;
      });
    }
    
    const test = Test.create();

    await test.once("value");

    expect(test.value).toBe("Hello World");
  })
})

describe("computed", () => {
  class Test extends Model {
    random = 0;
    source?: string = undefined;

    value = from(this, x => {
      void x.random;
      return x.source;
    }, true);
  }

  it("will suspend if value is undefined", async () => {
    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value");
      promise.resolve();
    })

    test.assertDidSuspend(true);

    instance.source = "foobar!";

    await promise.await();

    test.assertDidRender(true);
  })

  it("will suspend in method mode", async () => {
    class Test extends Model {
      source?: string = undefined;
      value = from(() => this.getValue, true);
  
      getValue(){
        return this.source;
      }
    }

    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value");
      promise.resolve();
    })

    test.assertDidSuspend(true);

    instance.source = "foobar!";

    await promise.await();

    test.assertDidRender(true);
  })

  it("will seem to throw error outside react", () => {
    const instance = Test.create();
    const expected = Oops.ValueNotReady(instance, "value");
    let didThrow: Error | undefined;

    try {
      void instance.value;
    }
    catch(err: any){
      didThrow = err;
    }

    expect(String(didThrow)).toBe(String(expected));
  })

  it("will return immediately if value is defined", async () => {
    const test = mockSuspense();
    const instance = Test.create();

    instance.source = "foobar!";

    let value: string | undefined;

    test.renderHook(() => {
      value = instance.tap("value");
    })

    test.assertDidRender(true);

    expect(value).toBe("foobar!");
  })

  it("will not resolve if value stays undefined", async () => {
    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value");
      promise.resolve();
    })

    test.assertDidSuspend(true);

    instance.random = 1;

    // update to value is expected
    const pending = await instance.update(true);
    expect(pending).toContain("random");

    // value will still be undefined
    expect(instance.export().value).toBe(undefined);

    // give react a moment to render (if it were)
    await new Promise(res => setTimeout(res, 100));

    // expect no action - value still is undefined
    test.assertDidRender(false);
  
    instance.source = "foobar!";

    // we do expect a render this time
    await promise.await();

    test.assertDidRender(true);
  })

  it.todo("will start suspense if value becomes undefined");
})