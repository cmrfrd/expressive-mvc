import { issues } from '../issues';
import { mayRetry } from '../suspense';
import { apply } from './apply';

export const Oops = issues({
  NonOptional: (Parent, key) => 
    `Property ${Parent}.${key} is marked as required.`,

  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`,

  Failed: (model, key) =>
    `Generating initial value for ${model}.${key} failed.`
})

declare namespace set {
  type Factory<T, S = unknown> = (this: S, key: string, subject: S) => T;

  type Callback<T, S = any> = (this: S, argument: T) =>
    ((next: T) => void) | Promise<any> | void | boolean;
}

 /**
  * Set property with an async function.
  * 
  * Property cannot be accessed until factory resolves, yeilding a result.
  * If accessed while processing, React Suspense will be thrown.
  * 
  * - `required: true` (default) -
  *      Run factory immediately upon creation of model instance.
  * - `required: false` -
  *      Run factory only if/when accessed.
  *      Value will always throw suspense at least once - use with caution.
  * 
  * @param factory - Callback run to derrive property value.
  * @param required - (default: true) Run factory immediately on creation, otherwise on access.
  */
function put <T> (factory: set.Factory<Promise<T>>, required: false): T | undefined;
function put <T, S> (factory: set.Factory<Promise<T>, S>, required: false): T | undefined;

function put <T> (factory: set.Factory<Promise<T>>, required?: boolean): T;
function put <T, S> (factory: set.Factory<Promise<T>, S>, required?: boolean): T;

 /**
  * Set property with a factory function.
  * 
  * - `required: true` (default) -
  *      Run factory immediately upon creation of model instance.
  * - `required: false` -
  *      Run factory only if/when accessed.
  *      Value will always throw suspense at least once - use with caution.
  * 
  * @param factory - Callback run to derrive property value.
  * @param required - (default: true) Run factory immediately on creation, otherwise on access.
  */
function put <T>(factory: set.Factory<T>, required: false): T | undefined;
function put <T, S>(factory: set.Factory<T, S>, required: false): T | undefined;

function put <T>(factory: set.Factory<T>, required?: boolean): T;
function put <T, S>(factory: set.Factory<T, S>, required?: boolean): T;

/**
 * Assign a property with result of a promise.
 */
function put <T> (factory: Promise<T>, required: false): T | undefined;
function put <T> (factory: Promise<T>, required?: boolean): T;

/**
 * Assign a property.
 */
function put <T> (factory: T, required: false): T | undefined;
function put <T> (factory: T, required?: boolean): T;

function put(
  factory?: any,
  required = true): any {  

  return apply(
    function set(key){
      const { subject, state } = this;

      let pending: Promise<any> | undefined;
      let error: any;

      const init = () => {
        const output = typeof factory == "function" ?
          mayRetry(() => factory.call(subject, key, subject)) :
          factory;

        if(output instanceof Promise){
          pending = output
            .catch(err => error = err)
            .then(val => {
              state.set(key, val);
              return val;
            })
            .finally(() => {
              pending = undefined;
              this.update(key);
            })

          return;
        }

        state.set(key, output);
        return output;
      }

      const suspend = () => {
        if(required === false)
          return;

        const issue =
          Oops.NotReady(subject, key);

        Object.assign(pending!, {
          message: issue.message,
          stack: issue.stack
        });

        throw pending;
      }

      if(required)
        try {
          init();
        }
        catch(err){
          Oops.Failed(subject, key).warn();
          throw err;
        }

      return {
        set(value: any){
          if(value === undefined && required)
            throw Oops.NonOptional(subject, key);
        },
        get(){
          if(pending)
            return suspend();
  
          if(error)
            throw error;
  
          if(state.has(key))
            return state.get(key);
  
          const output = init();
  
          return pending
            ? suspend()
            : output;
        }
      }
    }
  )
}

export { put }