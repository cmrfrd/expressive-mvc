import React from 'react';

import { render, subscribeTo } from '../helper/testing';
import { get } from '../instruction/get';
import { Consumer } from './consumer';
import { Oops } from './get';
import { Global } from './global';
import { MVC } from './mvc';
import { Provider } from './provider';

describe("context", () => {
  class Foo extends MVC {
    bar = get(Bar);
  }

  class Bar extends MVC {
    value = "bar";
  }

  it("will attach peer from context", () => {
    const bar = Bar.new();

    const Test = () => {
      const { bar } = Foo.use();
      expect(bar).toBe(bar);
      return null;
    }

    render(
      <Provider for={bar}>
        <Test />
      </Provider>
    );
  })

  it("will subscribe peer from context", async () => {
    class Foo extends MVC {
      bar = get(Bar, true);
    }

    const bar = Bar.new();
    let foo!: Foo;

    const Child = () => {
      foo = Foo.use();
      return null;
    }

    render(
      <Provider for={bar}>
        <Child />
      </Provider>
    )

    const update = subscribeTo(foo, it => it.bar.value);

    bar.value = "foo";
    await update();
  })

  it("will return undefined if instance not found", () => {
    class Foo extends MVC {
      bar = get(Bar, false);
    }

    const Test = () => {
      const foo = Foo.use();
      expect(foo.bar).toBeUndefined();
      return null;
    }

    render(<Test />);
  })

  it("will complain if instance not found", () => {
    class Foo extends MVC {
      bar = get(Bar);
    }

    const expected = Oops.AmbientRequired(Bar.name, Foo.name);
    const useFoo = () => Foo.use();

    const Test = () => {
      expect(useFoo).toThrowError(expected);
      return null;
    }

    render(<Test />);
  })

  it("will throw if strict tap is undefined", () => {
    class Foo extends MVC {
      bar = get(Bar);
    }

    const expected = Oops.AmbientRequired(Bar.name, Foo.name);
    const useStrictFooBar = () => Foo.use();

    const TestComponent = () => {
      expect(useStrictFooBar).toThrowError(expected);
      return null;
    }

    render(<TestComponent />);
  })

  it("will access while created by provider", () => {
    render(
      <Provider for={Bar}>
        <Provider for={Foo}>
          <Consumer for={Foo} has={i => expect(i.bar).toBeInstanceOf(Bar)} />
        </Provider>
      </Provider>
    );
  })

  it("will access peers sharing same provider", () => {
    class Foo extends MVC {
      bar = get(Bar);
    }
    class Bar extends MVC {
      foo = get(Foo);
    }

    render(
      <Provider for={{ Foo, Bar }}>
        <Consumer for={Bar} has={i => expect(i.foo.bar).toBe(i)} />
        <Consumer for={Foo} has={i => expect(i.bar.foo).toBe(i)} />
      </Provider>
    );
  });

  it("will assign multiple peers", async () => {
    class Foo extends MVC {
      value = 2;
    };

    class Baz extends MVC {
      bar = get(Bar);
      foo = get(Foo);
    };

    const Inner = () => {
      const { bar, foo } = Baz.use();

      expect(bar).toBeInstanceOf(Bar);
      expect(foo).toBeInstanceOf(Foo);

      return null;
    }

    render(
      <Provider for={{ Foo, Bar }}>
        <Inner />
      </Provider>
    );
  })
})

describe("singleton", () => {
  it("will attach to model", () => {
    class Foo extends MVC {
      global = get(TestGlobal);
    }

    class TestGlobal extends Global {
      value = "bar";
    }

    TestGlobal.new();

    const Test = () => {
      const { global } = Foo.use();
      expect(global.value).toBe("bar");
      return null;
    }

    render(<Test />);
  })

  it("will attach to another singleton", () => {
    class Peer extends Global {}
    class Test extends Global {
      peer = get(Peer);
    }

    const peer = Peer.new();
    const global = Test.new();    

    expect(global.peer).toBe(peer);
  })

  it("will throw if tries to attach Model", () => {
    class Normal extends MVC {}
    class TestGlobal extends Global {
      notPossible = get(Normal);
    }

    const attempt = () => TestGlobal.new();
    const issue = Oops.NotAllowed(TestGlobal.name, Normal.name);

    expect(attempt).toThrowError(issue);
  })
})

describe("suspense", () => {
  it("will throw if not resolved", () => {
    class Foo extends MVC {}
    class Bar extends MVC {
      foo = get(Foo);
    }

    const bar = Bar.new();
    
    expect(() => bar.foo).toThrow(expect.any(Promise));

    render(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    expect(bar.foo).toBeInstanceOf(Foo);
  });

  it("will resolve when assigned to", async () => {
    class Foo extends MVC {}
    class Bar extends MVC {
      foo = get(Foo);
    }

    const bar = Bar.new();
    let pending!: Promise<any>;

    try {
      void bar.foo;
    }
    catch(err: unknown){
      if(err instanceof Promise)
        pending = err;
    }
    
    expect(pending).toBeInstanceOf(Promise);

    render(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    await expect(pending).resolves.toBeUndefined();
  })

  it("will refresh an effect when assigned to", async () => {
    class Foo extends MVC {}
    class Bar extends MVC {
      foo = get(Foo);
    }

    const bar = Bar.new();
    const effect = jest.fn(bar => void bar.foo);

    bar.on(effect);

    expect(effect).toHaveBeenCalled();
    expect(effect).not.toHaveReturned();

    render(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    await bar.on();
    
    expect(effect).toHaveBeenCalledTimes(2);
    expect(effect).toHaveReturnedTimes(1);
  })

  it("will prevent compute if not resolved", () => {
    class Foo extends MVC {
      value = "foobar";
    }
    class Bar extends MVC {
      foo = get(Foo, foo => foo.value);
    }

    const bar = Bar.new();
    
    expect(() => bar.foo).toThrow(expect.any(Promise));

    render(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    expect(bar.foo).toBe("foobar");
  })
})