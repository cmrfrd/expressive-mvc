import { Control, LISTEN } from '../control';
import { Debug, LOCAL } from '../debug';
import { Subscriber } from '../subscriber';
import { suspend } from '../suspense';
import { Callback } from '../types';
import { defineProperty } from '../util';

const PENDING = new Map<symbol, Instruction.Runner<any>>();

/**
 * Property initializer, will run upon instance creation.
 * Optional returned callback will run when once upon first access.
 */
type Instruction<T> = (this: Control, key: string, thisArg: Control) =>
  | Instruction.Getter<T> 
  | Instruction.ExplicitDescriptor
  | Instruction.Descriptor<T>
  | Instruction.RecursiveDescriptor<T>
  | boolean
  | void;

declare namespace Instruction {
  type Getter<T> = (within?: Subscriber) => T;
  type Setter<T> = (value: T) => boolean | void;

  type Runner<T> = (this: Control, key: string, on: Control) =>
    Instruction.Descriptor<T> | boolean | undefined;

  interface Descriptor<T> {
    configurable?: boolean;
    enumerable?: boolean;
    value?: T;
    writable?: boolean;
    get?: Getter<T>;
    set?: Setter<T> | false;
    suspend?: boolean;
    destroy?: () => void;
  }

  interface ExplicitDescriptor extends PropertyDescriptor {
    explicit: true;
  }

  interface RecursiveDescriptor<T> {
    recursive: true;
    enumerable?: boolean;
    value?: T;
    set?: Setter<T> | false;
    suspend?: boolean;
  }
}

/**
 * Run instruction as controller sets itself up.
 * This will specialize the behavior of a given property.
 */
function apply <T = any> (instruction: Instruction<T>, name?: string): T;

function apply<T = any>(
  fn: Instruction<any>, label?: string){

  const name = label || fn.name || "pending";
  const placeholder = Symbol(`${name} instruction`);

  function setup(this: Control, key: string){
    const { subject, state } = this;

    let output = fn.call(this, key, this);

    if(typeof output == "function")
      output = { get: output };

    if(typeof output != "object")
      return;

    if("explicit" in output && output.explicit){
      defineProperty(subject, key, output);
      return false;
    }

    let {
      get: onGet,
      set: onSet,
      suspend: shouldSuspend
    } = output as Instruction.Descriptor<any>;

    if("value" in output)
      state.set(key, output.value);

    if("recursive" in output && output.recursive)
      onGet = getRecursive(key, this);

    if("destroy" in output){
      const { destroy } = output;

      if(destroy)
        this.addListener((key) => {
          if(key == null)
            destroy();
        })
    }

    const control = this;

    defineProperty(subject, key, {
      enumerable: output.enumerable,

      set: onSet !== false
        ? this.ref(key, onSet)
        : undefined,

      get(this: Debug<any>){
        if(!state.has(key) && shouldSuspend)
          throw suspend(control, key);
  
        const listen = LISTEN.get(this);
        const local = this[LOCAL];
  
        if(listen)
          listen(key);
  
        return onGet
          ? onGet(local)
          : state.get(key);
      }
    });
  }

  PENDING.set(placeholder, setup);

  return placeholder as unknown as T;
}

export function getRecursive(key: string, from: Control){
  const context = new WeakMap<Subscriber, {} | undefined>();

  return (local: Subscriber | undefined) => {
    if(!local)
      return from.state.get(key);

    if(!context.has(local)){
      let reset: Callback | undefined;

      const init = () => {
        if(reset)
          reset();

        const value = from.state.get(key);
  
        if(Control.get(value)){
          const child = Control.has(value).subscribe(local.onUpdate);
  
          if(local.active)
            child.commit();
  
          local.dependant.add(child);
          context.set(local, child.proxy);

          reset = () => {
            child.release();
            local.dependant.delete(child);
            context.set(local, undefined);
            reset = undefined;
          }
        }

        return true;
      }
  
      local.add(key, init);
      init();
    }

    return context.get(local);
  }
}

export { apply, Instruction, PENDING }