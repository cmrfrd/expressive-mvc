import {
  accessFromContext,
  accessFromController,
  attachFromContext,
  controllerCreateParent,
  getContext,
  getControlProvider,
  watchFromContext,
  watchFromController,
} from './context';
import { applyExternal, ensureDispatch, NEW_SUB } from './dispatch';
import { ModelController } from './types';
import { useOwnController } from './use_hook';

const { 
  defineProperty: define 
} = Object;

function returnThis(this: any){ return this }

/** Just the host function, nothing initialized here */
export function Controller(this: ModelController){
  if(this.didInit)
    setImmediate(() => this.didInit!())
}

const prototype = Controller.prototype = {} as any;

for(const f of ["on", "not", "only", "once"])
  prototype[f] = returnThis;

prototype.watch = applyExternal;
prototype.willDestroy = function(cb?: () => void){ if(cb) cb() };

define(prototype, NEW_SUB, {
  get: ensureDispatch,
  configurable: true
})

define(prototype, "Provider", {
  get: getControlProvider
})

Controller.fetch = accessFromContext;
Controller.watch = watchFromContext;
Controller.attach = attachFromContext;
Controller.get = accessFromController;
Controller.tap = watchFromController;

Controller.sub = getContext;
Controller.context = getContext;

Controller.create = function 
  useOnce(...args: any[]){
    return useOwnController(this, args).once();
  }

Controller.use = function 
  use(...args: any[]){
    return useOwnController(this, args);
  }

define(Controller, "Provider", {
  get: controllerCreateParent 
})
