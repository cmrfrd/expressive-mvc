import * as Computed from './compute';
import { CONTROL, does, Instruction, LOCAL, Stateful } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { pendingAccess } from './peer';
import { createValueEffect, define, defineLazy, defineProperty, getOwnPropertyDescriptor, setAlias } from './util';

export const Oops = issues({
  DuplicateAction: (key) =>
    `Invoked action ${key} but one is already active.`,

  BadComputedSource: (model, property, got) =>
    `Bad from-instruction provided to ${model}.${property}. Expects an arrow-function or a Model as source. Got ${got}.`,

  PeerNotAllowed: (model, property) =>
    `Attempted to use an instruction result (probably use or tap) as computed source for ${model}.${property}. This is not possible.`
})

export const set = <T = any>(fn: Instruction<T>, name?: string): T => does(
  function set(key){
    let output = fn.call(this, key, this);

    if(typeof output == "function"){
      const getter = output;

      output = {
        ...getOwnPropertyDescriptor(this.subject, key),
        get(this: Stateful){
          return getter(this[LOCAL])
        }
      }
    }

    if(output)
      defineProperty(this.subject, key, output);
  }, 
  name || fn.name || "pending"
)

export const ref = <T>(cb?: InterceptCallback<T>): { current: T } => set(
  function ref(key){
    const refObjectFunction =
      this.setter(key, cb && createValueEffect(cb));

    defineProperty(refObjectFunction, "current", {
      set: refObjectFunction,
      get: () => this.state[key]
    })

    return {
      value: refObjectFunction
    };
  }
);

export const on = <T>(initial: T, cb: InterceptCallback<T>): T => set(
  function on(key){
    this.manage(key, initial, cb && createValueEffect(cb));
  }
);

export const memo = <T>(factory: () => T, defer?: boolean): T => set(
  function memo(key){
    const source = this.subject;
    const get = () => factory.call(source);

    if(defer)
      defineLazy(source, key, get);
    else
      define(source, key, get())
  }
);

export const lazy = <T>(value: T): T => set(
  function lazy(key){
    const source = this.subject as any;

    source[key] = value;
    defineProperty(this.state, key, {
      get: () => source[key]
    });
  }
);

export const act = <T extends Async>(task: T): T => set(
  function act(key){
    let pending = false;

    const invoke = (...args: any[]) => {
      if(pending)
        return Promise.reject(
          Oops.DuplicateAction(key)
        )

      pending = true;
      this.update(key);

      return new Promise(res => {
        res(task.apply(this.subject, args));
      }).finally(() => {
        pending = false;
        this.update(key);
      })
    };

    setAlias(invoke, `run ${key}`);
    defineProperty(invoke, "active", {
      get: () => pending
    })

    return {
      value: invoke,
      writable: false
    };
  }
)

type ComputeFunction<T, O = any> = (this: O, on: O) => T;
type ComputeFactory<T> = (key: string) => ComputeFunction<T>;

export function from<T, R = T>(
  source: ComputeFactory<T> | Stateful,
  setter?: ComputeFunction<T>,
  getter?: (this: Model, value: T, key: string) => R): R {

  return set(
    function from(key){
      const { subject } = this;
      let getSource = () => this;

      if(typeof source == "symbol")
        // Easy mistake, using a peer, will always be unresolved.
        throw Oops.PeerNotAllowed(subject, key);

      if(typeof source == "object")
        // replace source controller incase is different
        getSource = () => source[CONTROL];

      else if(!source.prototype)
        // specifically an arrow function (getter factory)
        setter = source.call(subject, key);

      else if(Model.isTypeof(source))
        // is a peer Model (constructor)
        getSource = pendingAccess(subject, source, key, true);

      else
        // Regular function is to ambiguous so not allowed.
        throw Oops.BadComputedSource(subject, key, source);
      
      Computed.prepare(this, key, getSource, setter!, getter);
    }
  )
}