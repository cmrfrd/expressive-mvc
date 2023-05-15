import { apply, Control, parent, watch } from '../control';
import { issues } from '../helper/issues';
import { Model } from '../model';
import { suspense } from '../suspense';

import type { Callback } from '../../types';

export const Oops = issues({
  PeerNotAllowed: (model, property) =>
    `Attempted to use an instruction result (probably use or get) as computed source for ${model}.${property}. This is not allowed.`,

  Failed: (parent, property, initial) =>
    `An exception was thrown while ${initial ? "initializing" : "refreshing"} ${parent}.${property}.`,

  Required: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}.`,

  Unexpected: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`,

  AmbientRequired: (requested, requester) =>
    `Attempted to find an instance of ${requested} in context. It is required by ${requester}, but one could not be found.`
});

declare namespace get {
  type Function<T, S = any> = (this: S, on: S) => T;

  type Factory<R, T> = (this: T, property: string, on: T) => Function<R, T>;

  type Source<T extends Model = Model> = (callback: (x: T) => void) => void;
}

type Type<T extends Model> = Model.Type<T> & typeof Model;

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class. 
 * @param required - Throw if controller is created independantly.
 */
function get <T extends Model> (Type: Model.Type<T>, required?: true): T;
function get <T extends Model> (Type: Model.Type<T>, required: boolean): T | undefined;

function get <R, T extends Model> (Type: Model.Type<T>, compute: (this: T, on: T) => R): Exclude<R, undefined>;
function get <R, T extends Model> (Type: Model.Type<T>, compute: (this: T, on: T) => R): R;

/**
 * Implement a computed value; output will be generated by provided function.
 *
 * @param source - Source model from which computed value will be a subscriber.
 * @param compute - Compute function. Bound to a subscriber-proxy of source, returns output value. Will update automatically as input values change.
 */
function get <R, T extends Model> (source: T, compute: (this: T, on: T) => R): Exclude<R, undefined>;
function get <R, T extends Model> (source: T, compute: (this: T, on: T) => R): R;

/**
 * Implement a computed value; output is returned by function from provided factory.
 *
 * @param compute - Factory function to generate a getter to subscribe dependancies.
 */
function get <R, T> (compute: (property: string, on: T) => (this: T, state: T) => R): Exclude<R, undefined>;
function get <R, T> (compute: (property: string, on: T) => (this: T, state: T) => R): R;
 
function get<R, T extends Model>(
  arg0: T | get.Factory<R, T> | Type<T>,
  arg1?: get.Function<R, T> | boolean){

  return apply<R>((key, control) => {
    let { subject } = control;

    if(typeof arg0 == "symbol")
      throw Oops.PeerNotAllowed(subject, key);

    let source: get.Source = cb => cb(subject);

    if(arg0 instanceof Model)
      subject = arg0;

    else if(Model.isTypeof(arg0)){
      const hasParent = parent(subject);

      if(!hasParent){
        if(arg1 === true)
          throw Oops.Required(arg0, subject);
        
        source = callback =>
          Control.has(subject, context => {
            const got = context.get(arg0);

            if(got)
              callback(got);
            else if(arg1 !== false)
              throw Oops.AmbientRequired(arg0, subject);
          });
      }
      else if(!arg0 || hasParent instanceof arg0)
        subject = hasParent;
      else
        throw Oops.Unexpected(arg0, subject, hasParent);
    }

    else if(typeof arg0 == "function")
      arg1 = arg0.call(subject, key, subject);

    return typeof arg1 == "function"
      ? computed(control, key, source, arg1)
      : recursive(control, key, source, arg1);
  })
}

function recursive(
  parent: Control,
  key: string,
  source: get.Source | undefined,
  required: boolean | undefined){

  let waiting: boolean;

  if(source)
    source((got) => {
      parent.state[key] = got;

      if(waiting)
        parent.update(key);
    });

  waiting = true;

  return () => {
    const value = parent.state[key];

    if(value)
      return value;

    if(required !== false)
      throw suspense(parent, key);
  }
}

const ORDER = new WeakMap<Callback, number>();
const PENDING = new Set<Callback>();

let OFFSET = 0;

function computed<T>(
  parent: Control,
  key: string,
  source: get.Source,
  setter: get.Function<T, any>){

  const { state } = parent;

  let proxy: any;
  let active: boolean;
  let isAsync: boolean;
  let reset: (() => void) | undefined;

  function compute(initial?: boolean){
    if(parent.frame.has(key))
      return;

    let next: T | undefined;

    try {
      next = setter.call(proxy, proxy);
    }
    catch(err){
      Oops.Failed(parent.subject, key, initial).warn();

      if(initial)
        throw err;
      
      console.error(err);
    }

    if(next !== state[key]){
      state[key] = next;

      if(!initial || isAsync)
        parent.update(key);
    }
  }

  function connect(model: Model){
    if(reset)
      reset();

    let done: boolean;

    reset = () => done = true;

    proxy = watch(model, (_, control) => {
      if(done)
        return null;

      if(control !== parent)
        compute();
      else
        PENDING.add(compute);
    });

    try {
      compute(true);
    }
    finally {
      ORDER.set(compute, OFFSET++);
    }
  }

  return () => {
    if(!active){
      active = true;
      source(connect);
      isAsync = true;
    }
    
    if(!proxy)
      throw suspense(parent, key);

    if(PENDING.delete(compute))
      compute();

    return state[key];
  }
}

function flushComputed(){
  while(PENDING.size){
    let compute!: Callback;

    for(const item of PENDING)
      if(!compute || ORDER.get(item)! < ORDER.get(compute)!)
        compute = item;

    PENDING.delete(compute);
    
    compute();
  }
}

Control.before.add(flushComputed);

export { get };