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
        instance.gc();
      }
    }, []);

    return instance;
  }

  const state = useState(0);
  const local = useMemo(() => {
    const refresh = state[1].bind(null, x => x+1);
    const control = Control.get(instance)!;
    let active: boolean | null = false;

    const proxy = Control.sub(instance, () => {
      if(active === null)
        throw 0;

      if(active)
        return refresh;
    });

    function apply(values: Model.Compat<T>){
      let keys = arg2 as Model.Key<T>[];
    
      active = false;
    
      if(!keys)
        keys = Object.getOwnPropertyNames(instance) as Model.Key<T>[];
    
      for(const key of keys)
        if(key in values)
          instance[key] = values[key]!;
    
      control.waiting.add(() => {
        active = true;
      });
    }

    function commit(){
      active = true;

      return () => {
        active = null;
        instance.gc();
      };
    }

    return { apply, commit, proxy }
  }, []);

  if(typeof arg1 == "object")
    local.apply(arg1);

  useLayoutEffect(local.commit, []);

  return local.proxy;
}

export { useModel }