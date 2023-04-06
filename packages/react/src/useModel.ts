import { Control, Model, Subscriber } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

import { usePeerContext } from './useContext';

function useModel <T extends Model> (
  this: Model.New<T>,
  callback?: (instance: T) => void
): T;

function useModel <T extends Model> (
  this: Model.New<T>,
  watch: Model.Key<T>[],
  callback?: (instance: T) => void
): T;

function useModel <T extends Model> (
  this: Model.New<T>,
  apply: Model.Compat<T>,
  keys?: Model.Event<T>[]
): T;

function useModel <T extends Model> (
  this: Model.New<T>,
  arg1?: ((i: T) => void) | Model.Event<T>[] | Model.Compat<T>,
  arg2?: ((i: T) => void) | Model.Key<T>[]){

  const instance = useMemo(() => {
    const callback = arg2 || arg1;
    const instance = new this();

    Control.for(instance);

    if(typeof callback == "function")
      callback(instance);

    return instance;
  }, []);

  usePeerContext(instance);

  if(Array.isArray(arg1)){
    const update = useState(0)[1];

    useLayoutEffect(() => {  
      if(arg1.length && instance instanceof Model)
        instance.on(arg1, () => update(x => x+1));

      return () => {
        instance.gc();
      }
    }, []);

    return instance;
  }

  const state = useState(0);
  const local = useMemo(() => {
    const refresh = state[1].bind(null, x => x+1);
    return new Subscriber(instance, () => refresh);
  }, []);

  if(typeof arg1 == "object")
    applyValues(local, arg1, arg2 as Model.Key<T>[]);

  useLayoutEffect(() => {
    local.commit();

    return () => {
      local.release();
      instance.gc();
    };
  }, []);

  return local.proxy;
}

// TODO: move back to MVC pending a generic use-case.
function applyValues<T>(
  target: Subscriber,
  values: Model.Compat<T>,
  keys: Model.Key<T>[] | undefined){

  const { waiting, subject } = target.parent;

  target.active = false;

  if(!keys)
    keys = Object.getOwnPropertyNames(subject) as Model.Key<T>[];

  for(const key of keys)
    if(key in values)
      subject[key] = values[key]!;

  waiting.add(() => target.active = true);
}

export { useModel }