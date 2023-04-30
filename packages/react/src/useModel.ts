import { Control, Model } from '@expressive/mvc';
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
        instance.null();
      }
    }, []);

    return instance;
  }

  const state = useState(0);
  const local = useMemo(() => {
    let refresh: (() => void) | undefined;
    let done: undefined | boolean;

    const ignore = new Set<string>();
    const reset = () => ignore.clear();
    const update = () => {
      state[1](x => x+1);
      ignore.clear();
    }

    const proxy = Control.sub(instance, (key) => {
      if(ignore.has(key!))
        return reset;

      return done ? null : refresh;
    });

    function apply(values: Model.Compat<T>){
      let keys = arg2 as Model.Key<T>[];
    
      if(!keys)
        keys = Object.getOwnPropertyNames(instance) as Model.Key<T>[];
    
      for(const key of keys)
        if(key in values){
          ignore.add(key);
          instance[key] = values[key]!;
        }
    }

    function commit(){
      refresh = update;
      return () => {
        done = true;
        instance.null();
      }
    }

    return {
      apply,
      commit,
      proxy
    };
  }, []);

  if(typeof arg1 == "object")
    local.apply(arg1);

  useLayoutEffect(local.commit, []);

  return local.proxy;
}

export { useModel }