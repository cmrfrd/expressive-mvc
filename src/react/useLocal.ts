import React from 'react';

import { issues } from '../issues';
import { Model } from '../model';
import { Lookup } from '../register';
import { InstanceOf } from '../types';

export const LookupContext = React.createContext(new Lookup());
export const useLookup = () => React.useContext(LookupContext);

export const Oops = issues({
  NotFound: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`
})

export function useLocal<T extends typeof Model>(
  Type: T, arg?: boolean | string) {

  const instance = useLookup().get(Type);

  if (!instance && arg !== false)
    throw Oops.NotFound(Type.name);

  return typeof arg == "string" ?
    (instance as any)[arg] :
    instance as InstanceOf<T>;
}
