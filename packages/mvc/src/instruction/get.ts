import { getParent, getRecursive } from '../children';
import { Control } from '../control';
import { issues } from '../helper/issues';
import { Callback } from '../helper/types';
import { Model } from '../model';
import { Subscriber } from '../subscriber';
import { add } from './add';

export const Oops = issues({
  PeerNotAllowed: (model, property) =>
    `Attempted to use an instruction result (probably use or get) as computed source for ${model}.${property}. This is not allowed.`,

  Failed: (parent, property, initial) =>
    `An exception was thrown while ${initial ? "initializing" : "refreshing"} [${parent}.${property}].`,

  Required: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,
});

declare namespace instruction {
  type Function<T, S = any> = (this: S, on: S) => T;

  type Factory<R, T> = (this: T, property: string, on: T) => Function<R, T>;

  type FindFunction = <T extends Model>(
    type: Model.Type<T>,
    relativeTo: Model,
    required: boolean
  ) => (_refresh: (x: T) => void) => T | undefined;

  /** Fetch algorithm for get instruction. */
  export let using: (fn: FindFunction) => typeof instruction;
}

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class. 
 * @param required - Throw if controller is created independantly.
 */
function instruction <T extends Model> (Type: Model.Type<T>, required?: true): T;
function instruction <T extends Model> (Type: Model.Type<T>, required: boolean): T | undefined;

function instruction <R, T extends Model> (Type: Model.Type<T>, compute: (this: T, on: T) => R): Exclude<R, undefined>;
function instruction <R, T extends Model> (Type: Model.Type<T>, compute: (this: T, on: T) => R): R;

/**
 * Implement a computed value; output will be generated by provided function.
 *
 * @param source - Source model from which computed value will be a subscriber.
 * @param compute - Compute function. Bound to a subscriber-proxy of source, returns output value. Will update automatically as input values change.
 */
function instruction <R, T> (source: T, compute: (this: T, on: T) => R): Exclude<R, undefined>;
function instruction <R, T> (source: T, compute: (this: T, on: T) => R): R;

/**
 * Implement a computed value; output is returned by function from provided factory.
 *
 * @param compute - Factory function to generate a getter to subscribe dependancies.
 */
function instruction <R, T> (compute: (property: string, on: T) => (this: T, state: T) => R): Exclude<R, undefined>;
function instruction <R, T> (compute: (property: string, on: T) => (this: T, state: T) => R): R;
 
function instruction<R, T extends Model>(
  this: instruction.FindFunction,
  arg0: instruction.Factory<R, T> | (Model.Type<T> & typeof Model) | T,
  arg1?: instruction.Function<R, T> | boolean): R {

  const fetch = this;

  return add(
    function get(key){
      const { subject, state } = this;

      // Easy mistake, using a peer, will always be unresolved.
      if(typeof arg0 == "symbol")
        throw Oops.PeerNotAllowed(subject, key);

      let source!: (refresh: (x: any) => void) => Model | undefined;
      const sourceRequired = arg1 !== false;

      if(arg0 instanceof Model){
        source = () => arg0;

        if(typeof arg1 !== "function")
          throw new Error(`Factory argument cannot be ${arg1}`);
      }
      else if(Model.isTypeof(arg0)){
        source = fetch(arg0, subject, sourceRequired)!;
      }
      else if(typeof arg0 == "function"){
        source = () => subject;
        arg1 = arg0.call(subject, key, subject);
      }

      if(typeof arg1 == "function")
        return getComputed(key, this, source, arg1);

      const init = source((got) => {
        state.set(key, got)
        this.update(key);
      });

      // TODO: remove fixes suspense test
      if(init || arg1 === false)
        state.set(key, init);

      return getRecursive(key, this);
    }
  )
}

function getParentForGetInstruction<T extends Model>(
  type: Model.Type<T>,
  relativeTo: Model,
  required: boolean){

  const item = getParent(relativeTo, type);

  return (_refresh: (x: T) => void) => {
    if(item)
      return item;
    
    if(required)
      throw Oops.Required(type.name, relativeTo);
  };
}

function getComputed<T>(
  key: string,
  parent: Control,
  source: (refresh: () => void) => Model | undefined,
  setter: instruction.Function<T, any>){

  const { state } = parent;

  let sub: Subscriber;
  let order = ORDER.get(parent)!;
  let pending = KEYS.get(parent)!;
  let instance: Model;

  const compute = (initial: boolean) => {
    try {
      return setter.call(sub.proxy, sub.proxy);
    }
    catch(err){
      Oops.Failed(instance, key, initial).warn();
      throw err;
    }
  }

  const bootstrap = () => {
    // TODO: replace create with a cleanup function
    const got = source(bootstrap);

    if(!got)
      parent.waitFor(key);

    instance = got;

    sub = new Subscriber(instance, (_, control) => {
      if(control !== parent)
        refresh();
      else
        pending.add(refresh);
    });

    sub.watch.set(key, false);

    try {
      const value = compute(true);
      state.set(key, value);
    }
    finally {
      sub.commit();
      order.set(refresh, order.size);
    }
  }

  const refresh = () => {
    let value;

    try {
      value = compute(false);
    }
    catch(e){
      console.error(e);
    }
    finally {
      if(state.get(key) !== value){
        state.set(key, value);
        parent.update(key);
      }
    }
  }

  INFO.set(refresh, key);

  if(!order)
    ORDER.set(parent, order = new Map());

  if(!pending)
    KEYS.set(parent, pending = new Set());

  return () => {
    if(pending.has(refresh)){
      pending.delete(refresh)
      refresh();
    }

    if(!sub)
      bootstrap();

    return state.get(key);
  }
}

const INFO = new WeakMap<Callback, string>();
const KEYS = new WeakMap<Control, Set<Callback>>();
const ORDER = new WeakMap<Control, Map<Callback, number>>();

function flush(control: Control){
  const pending = KEYS.get(control);

  if(!pending || !pending.size)
    return;

  const priority = ORDER.get(control)!;

  while(pending.size){
    let compute!: Callback;

    for(const item of pending)
      if(!compute || priority.get(item)! < priority.get(compute)!)
        compute = item;

    pending.delete(compute);

    const key = INFO.get(compute)!;

    if(!control.frame.has(key))
      compute();
  }

  pending.clear();
}

function using(fn: instruction.FindFunction){
  return Object.assign(instruction.bind(fn), { using, fn });
}

const get = using(getParentForGetInstruction);

export {
  flush,
  get
}