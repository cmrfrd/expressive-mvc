import { Context, Model } from '@expressive/mvc';
import { createContext, useContext } from 'react';

export const LookupContext = createContext(new Context());
export const useLookup = () => useContext(LookupContext);

const Pending = new WeakMap<{}, ((context: Context) => void)[]>();
const Applied = new WeakMap<Model, boolean>();

export function usePeerContext(instance: Model){
  const applied = Applied.get(instance);

  if(applied)
    useLookup();

  else if(applied === undefined){
    const pending = Pending.get(instance);

    if(pending){
      const local = useLookup();

      pending.forEach(init => init(local));
      Pending.delete(instance);
      Applied.set(instance, true);
    }
  }
}

export function peerContext(
  model: Model,
  hasContext: ((has: Context) => void) | Context
){
  let pending = Pending.get(model);
    
  if(!pending)
    Pending.set(model, pending = []);

  if(typeof hasContext == "function")
    pending.push(hasContext);
  else
    pending.forEach(cb => cb(hasContext));
}