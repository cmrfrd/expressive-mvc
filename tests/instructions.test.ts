import { renderHook } from '@testing-library/react-hooks';

import { Oops } from '../src/instructions';
import { Subscriber } from '../src/subscriber';
import { act, lazy, memo, Model, on, ref, declare, use } from './adapter';

describe("on", () => {
  class Subject extends Model {
    checkResult?: any = undefined;
  
    test1 = on<number>(value => {
      this.checkResult = value + 1;
    });
  
    test2 = on<number>(value => {
      return () => {
        this.checkResult = true;
      }
    });
  
    test3 = on("foo", value => {
      this.checkResult = value;
    });
  }
  
  it('will invoke callback on property set', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    expect(state.checkResult).toBe(undefined);
    state.once("test1", callback);

    state.test1 = 1;
    expect(state.checkResult).toBe(2);

    await state.update(true)
    expect(callback).toBeCalledWith(1, "test1");
  })
  
  it('will invoke return-callback on overwrite', async () => {
    const state = Subject.create();
  
    state.test2 = 1;

    await state.update(true);
    expect(state.checkResult).toBe(undefined);
    state.test2 = 2;

    await state.update(true);
    expect(state.checkResult).toBe(true);
  })
  
  it('will assign a default value', async () => {
    const state = Subject.create();
  
    expect(state.test3).toBe("foo");
    state.test3 = "bar";

    await state.update();
    expect(state.checkResult).toBe("bar");
  })
})

describe("use", () => {
  const WORLD = "Hello World!";

  class Parent extends Model {
    hello?: string = undefined;

    child = use(Child as any, (child: any) => {
      this.hello = child.hello;
    }) as Child;
  }

  class Child extends Model {
    hello = WORLD;
  }

  let parent: Parent;

  beforeAll(() => {
    parent = Parent.create();
  })

  it('will create instance of child', () => {
    expect(parent.child).toBeInstanceOf(Child);
  })

  it('will run child callback on create', () => {
    expect(parent.hello).toBe(WORLD);
  })
})

describe("ref", () => {
  class Subject extends Model {
    checkValue?: any = undefined;
  
    ref1 = ref<string>();
  
    ref2 = ref<symbol>(value => {
      this.checkValue = value;
    })
  
    ref3 = ref<number>(() => {
      return () => {
        this.checkValue = true;
      }
    })
  }

  it('will fetch value from ref-object', async () => {
    const state = Subject.create();

    state.ref1.current = "foobar";
    await state.update(true);
    expect(state.ref1.current).toBe("foobar");
  })
  
  it('will watch "current" of property', async () => {
    const state = Subject.create();
    const callback = jest.fn()
  
    state.once("ref1", callback);
    state.ref1.current = "foobar";
    await state.update(true);
    expect(callback).toBeCalledWith("foobar", "ref1");
  })
  
  it('will update "current" when property invoked', async () => {
    const state = Subject.create();
    const callback = jest.fn()
  
    state.once("ref1", callback);
    state.ref1("foobar");
    await state.update(true);
    expect(callback).toBeCalledWith("foobar", "ref1");
  })
  
  it('will invoke callback if exists', async () => {
    const state = Subject.create();
    const targetValue = Symbol("inserted object");
    const callback = jest.fn();
  
    expect(state.checkValue).toBe(undefined);
    state.once("ref2", callback);
    state.ref2.current = targetValue;
    expect(state.checkValue).toBe(targetValue);
    await state.update(true);
    expect(callback).toBeCalledWith(targetValue, "ref2");
  })
  
  it('will invoke return-callback on overwrite', async () => {
    const state = Subject.create();
  
    state.ref3.current = 1;
    await state.update();
    expect(state.checkValue).toBe(undefined);
    state.ref3.current = 2;
    await state.update();
    expect(state.checkValue).toBe(true);
  })

  it('will export value of ref-properties', () => {
    const test = Subject.create();
    const values = {
      ref1: "foobar",
      ref2: Symbol("foobar"),
      ref3: 69420
    }

    test.ref1(values.ref1);
    test.ref2(values.ref2);
    test.ref3(values.ref3);

    const state = test.export();

    expect(state).toMatchObject(values);
  })
})

describe("act", () => {
  class Test extends Model {
    test = act(this.wait);
    nope = act(this.fail);

    async wait<T>(input?: T){
      return new Promise<T | undefined>(res => {
        setTimeout(() => res(input), 1)
      });
    }

    async fail(){
      await new Promise(r => setTimeout(r, 1));
      throw new Error("Nope");
    }
  }

  it("will pass arguments to wrapped function", async () => {
    const control = Test.create();
    const input = Symbol("unique");
    const output = control.test(input);
    
    await expect(output).resolves.toBe(input);
  })

  it("will set active to true for run-duration", async () => {
    const { test } = Test.create();

    expect(test.active).toBe(false);

    const result = test("foobar");
    expect(test.active).toBe(true);

    const output = await result;

    expect(output).toBe("foobar");
    expect(test.active).toBe(false);
  })

  it("will emit method key before/after activity", async () => {
    let update: string[] | false;
    const { test, get } = Test.create();

    expect(test.active).toBe(false);

    const result = test("foobar");
    update = await get.update(true);

    expect(test.active).toBe(true);
    expect(update).toContain("test");

    const output = await result;
    update = await get.update(true);

    expect(test.active).toBe(false);
    expect(update).toContain("test");
    expect(output).toBe("foobar");
  })

  it("will throw immediately if already in-progress", () => {
    const { test } = Test.create();
    const expected = Oops.DuplicateAction("test");

    test();
    expect(() => test()).rejects.toThrowError(expected);
  })

  it("will throw and reset if action fails", async () => {
    const { nope, get } = Test.create();

    expect(nope.active).toBe(false);

    const result = nope();

    await get.update(true);
    expect(nope.active).toBe(true);

    await expect(result).rejects.toThrowError();

    expect(nope.active).toBe(false);
  })

  it("will complain if property is redefined", () => {
    const state = Test.create();
    const assign = () => state.test = 0 as any;

    expect(assign).toThrowError();
  })
})

describe("lazy", () => {
  class Test extends Model {
    lazy = lazy("foo");
    eager = "bar";
  }

  it("will set starting value", async () => {
    const state = Test.create();

    expect(state.lazy).toBe("foo");
  });

  it("will ignore updates", async () => {
    const state = Test.create();

    expect(state.lazy).toBe("foo");
    
    state.lazy = "bar";
    await state.update(false);

    expect(state.lazy).toBe("bar");
    
    state.eager = "foo";
    await state.update(true);
  });

  it("will include key on import", () => {
    const state = Test.create();
    const assign = {
      lazy: "bar",
      eager: "foo"
    };
    
    state.import(assign);
    expect(assign).toMatchObject(state);
  });

  it("will include value on export", async () => {
    const state = Test.create();
    const values = state.export();

    expect(values).toMatchObject({
      lazy: "foo",
      eager: "bar"
    })
  });

  it("will not include in subscriber", async () => {
    const element = renderHook(() => Test.use());
    const proxy = element.result.current;
    const subscriberOverlay =
      Object.getOwnPropertyNames(proxy);

    // lazy should be still be visible
    expect(proxy.lazy).toBe("foo");

    // there should be no spy getter however
    expect(subscriberOverlay).not.toContain("lazy");
    expect(subscriberOverlay).toContain("eager");
  });
})

describe("memo", () => {
  class Test extends Model {
    ranMemo = jest.fn();
    ranLazyMemo = jest.fn();

    memoized = memo(() => {
      this.ranMemo();
      return "foobar";
    });

    memoLazy = memo(() => {
      this.ranLazyMemo();
      return "foobar";
    }, true);
  }

  it("will run memoize on create", () => {
    const state = Test.create();

    expect(state.memoized).toBe("foobar");
    expect(state.ranMemo).toBeCalled();
  })

  it("will run memoLazy on first access", () => {
    const state = Test.create();

    expect(state.ranLazyMemo).not.toBeCalled();

    expect(state.memoLazy).toBe("foobar");
    expect(state.ranLazyMemo).toBeCalled();
  })
})

describe("declare", () => {
  class Test extends Model {
    didRunInstruction = jest.fn();
    didRunGetter = jest.fn();

    property = declare((key) => {
      this.didRunInstruction(key);

      return () => {
        this.didRunGetter(key);
      }
    })

    memoedProperty = declare((key) => {
      return () => {
        this.didRunGetter(key);
      }
    }, true)

    keyedInstruction = declare(function foo(){});
    namedInstruction = declare(() => {}, false, "foo");
  }

  it("will use symbol as placeholder", () => {
    const { property } = new Test();
    const { description } = property as any;

    expect(typeof property).toBe("symbol");
    expect(description).toBe("pending instruction");
  })

  it("will give placeholder custom name", () => {
    const { keyedInstruction } = new Test();
    const { description } = keyedInstruction as any;

    expect(description).toBe("foo instruction");
  })

  it("will give placeholder custom name", () => {
    const { namedInstruction } = new Test();
    const { description } = namedInstruction as any;

    expect(description).toBe("foo instruction");
  })

  it("will run instruction on create", () => {
    const { didRunInstruction: ran } = Test.create();

    expect(ran).toBeCalledWith("property");
  })

  it.skip("will run instruction getter", async () => {
    const instance = Test.create();
    const ran = instance.didRunGetter;

    instance.effect(x => {
      void x.property;
    })
    
    expect(ran).toBeCalledWith("property");

    instance.update("property");
    await instance.update(true);

    expect(ran).toBeCalledTimes(2);
  })

  it.skip("will run instruction in memo mode", async () => {
    const instance = Test.create();
    const ran = instance.didRunGetter;

    instance.effect(x => {
      void x.property;
    })
    
    expect(ran).toBeCalledWith("property");

    instance.update("property");
    await instance.update(true);

    expect(ran).toBeCalledTimes(1);
  })
})

describe("get", () => {
  class Test extends Model {
    didRunInstruction = jest.fn();
    didGetSubscriber = jest.fn();

    property = declare((key) => (sub) => {
      this.didRunInstruction(key);
      this.didGetSubscriber(sub);

      return "foobar";
    })
  }

  it("will run instruction on access", () => {
    const instance = Test.create();
    const ran = instance.didRunInstruction;
    
    expect(ran).not.toBeCalled();
    expect(instance.property).toBe("foobar");
    expect(ran).toBeCalledWith("property");
  })

  it("will pass undefined for subscriber", () => {
    const instance = Test.create();
    const got = instance.didGetSubscriber;
    
    expect(instance.property).toBe("foobar");
    expect(got).toBeCalledWith(undefined);
  })

  it("will pass undefined for subscriber", () => {
    const instance = Test.create();
    const got = instance.didGetSubscriber;
    
    expect(instance.property).toBe("foobar");
    expect(got).toBeCalledWith(undefined);
  })

  it("will pass subscriber if within one", () => {
    const state = Test.create();
    const got = state.didGetSubscriber;

    state.effect(own => {
      expect(own.property).toBe("foobar");
    });

    expect(got).toBeCalledWith(expect.any(Subscriber));
  });
})