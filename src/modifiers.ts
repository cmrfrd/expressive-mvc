import type { Model } from './model';

import { Lookup } from './context';
import { Controller } from './controller';
import { Observer } from './observer';
import { Singleton } from './singleton';
import { alias, createEffect, define, defineLazy, defineProperty } from './util';

import Oops from './issues';

const ParentRelationship = new WeakMap<{}, {}>();

export function setChild<T extends typeof Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  return Observer.define((key, { subject }) => {
    const instance = new Peer() as InstanceOf<T>;

    define(subject, key, instance);

    ParentRelationship.set(instance, subject);
    Controller.get(instance);

    if(callback)
      callback(instance);
  })
}

export function setParent<T extends typeof Model>
  (Expects: T, required?: boolean): InstanceOf<T> {

  return Observer.define((key, { subject }) => {
    const expectsType = Expects.name;
    const onType = subject.constructor.name;
    const parent = ParentRelationship.get(subject);

    if(!parent){
      if(required)
        throw Oops.ParentRequired(expectsType, onType);
    }
    else if(!(parent instanceof Expects)){
      const gotType = parent.constructor.name;
      throw Oops.UnexpectedParent(expectsType, onType, gotType);
    }

    define(subject, key, parent);
  })
}

export const PendingContext = new Set<(context: Lookup) => void>();

export function setPeer<T extends typeof Model>
  (Peer: T, required?: boolean): InstanceOf<T> {

  return Observer.define((key, { subject }) => {
    const Self = subject.constructor.name;

    if(Singleton.isTypeof(Peer))
      defineLazy(subject, key, () => Peer.find(true));
    else if(subject instanceof Singleton)
      throw Oops.CantAttachGlobal(subject.constructor.name, Peer.name);
    else {
      function insert(context: Lookup){
        const remote = context.get(Peer);

        if(!remote && required)
          throw Oops.AmbientRequired(Peer.name, Self, key);

        define(subject, key, remote);
      }

      PendingContext.add(insert);
      define(subject, key, insert);
    }
  })
}

export function setRefObject<T = any>
  (effect?: EffectCallback<Model, any>): { current: T } {

  return Observer.define((key, on) => {
    on.assign(key, {
      value: defineProperty({}, "current", {
        get: on.getter(key),
        set: on.setter(key,
          effect && createEffect(effect)
        )
      })
    });
  })
}

export function setEffect<T = any>
  (value: any, effect?: EffectCallback<Model, T>): T {

  if(!effect){
    effect = value;
    value = undefined;
  }

  return Observer.define((key, on) => {
    on.monitorValue(key, value, createEffect(effect!));
  })
}

export function setMemo(factory: () => any, defer?: boolean){
  return Observer.define((key, { subject }) => {
    const get = () => factory.call(subject);

    if(defer)
      defineLazy(subject, key, get);
    else
      define(subject, key, get())
  }) 
}

export function setIgnored(value: any){
  return Observer.define((key, on) => {
    (on.subject as any)[key] = value;
  })
}

export function setTuple<T extends any[]>
  (...values: T): T {

  if(values.length == 0)
    values = undefined as any;
  else if(values.length == 1 && typeof values[0] == "object")
    values = values[0] as any;
  
  return Observer.define((key, on) => {
    const source = on.state;

    const setTuple = (next: any) => {
      const current: any = source[key];
      let update = false;

      if(!current){
        update = true;
        source[key] = current;
      }
      else 
        for(const k in current)
          if(current[k] !== next[k]){
            current[k] = next[k];
            update = true;
          }

      if(update)
        on.emit(key);
    };

    source[key] = values;
    on.assign(key, {
      get: on.getter(key),
      set: alias(setTuple, `set ${key}`)
    });

  })
}

type AsyncFn<T = any> = (...args: any[]) => Promise<T>;

export function setAction(action: AsyncFn){
  return Observer.define((key, on) => {
    let pending = false;

    function invoke(...args: any[]){
      if(pending)
        return Promise.reject(
          Oops.DuplicateAction(key)
        )

      pending = true;
      on.emit(key);

      return action
        .apply(on.subject, args)
        .finally(() => {
          pending = false;
          on.emit(key);
        })
    };

    alias(invoke, `run ${key}`);
    defineProperty(invoke, "active", {
      get: () => pending
    })

    on.assign(key, {
      get: () => invoke,
      set: () => {
        throw Oops.SetActionProperty(key);
      }
    });
  })
}