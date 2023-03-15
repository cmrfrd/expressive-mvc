import { Control, PENDING } from '../control';
import { defineProperty } from '../helper/object';
import { Subscriber, subscriber } from '../subscriber';
import { suspend } from '../suspense';

/**
 * Property initializer, will run upon instance creation.
 * Optional returned callback will run when once upon first access.
 */
type Instruction<T> = (this: Control, key: string, thisArg: Control) =>
  | Instruction.Getter<T>
  | Instruction.Descriptor<T>
  | void;

declare namespace Instruction {
  type Getter<T> = (within?: Subscriber) => T;
  type Setter<T> = (value: T) => boolean | void;

  type Runner = (on: Control, key: string) =>
    Instruction.Descriptor<any> | undefined;

  interface Descriptor<T> {
    enumerable?: boolean;
    value?: T;
    get?: Getter<T>;
    set?: Setter<T> | false;
  }
}

/**
 * Run instruction as controller sets itself up.
 * This will specialize the behavior of a given property.
 */
function add<T = any>(
  instruction: Instruction<any>,
  label?: string){

  const name = label || instruction.name || "pending";
  const placeholder = Symbol(`${name} instruction`);

  PENDING.set(placeholder, (control: Control, key: string) => {
    let output = instruction.call(control, key, control);

    if(!output)
      return undefined;

    if(typeof output == "function")
      output = { get: output };

    if("value" in output)
      control.state.set(key, output.value);

    let { enumerable, get, set } = output;

    defineProperty(control.subject, key, {
      enumerable,
      set: (
        set === false
          ? undefined
          : control.ref(key, set)
      ),
      get(this: any){
        const local = subscriber(this);

        if(local)
          local.follow(key);
  
        try {
          const value = get ? get(local) : control.state.get(key);
          
          if(value === undefined && local && local.strict === true)
            throw suspend(control, key);
            
          return value;
        }
        catch(err){
          if(err instanceof Promise && local && local.strict === false)
            return;

          throw err;
        }
      }
    });
  });

  return placeholder as unknown as T;
}

export { add, Instruction }