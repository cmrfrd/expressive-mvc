import { Controller } from '../controller';
import { CONTROL, Model } from '../model';
import { useInContext, useModel, useNew, useTap } from './hooks';
import { usePeerContext } from './peer';

export class MVC extends Model {
  static [CONTROL]: Controller;

  /** Attaches this controller to a component. */
  tap(): this;

  tap <K extends Model.Fields<this>> (key: K, expect: true): Exclude<this[K], undefined>;
  tap <K extends Model.Fields<this>> (key: K, expect?: boolean): this[K];

  tap <T> (from: (this: this, state: this) => Promise<T>, expect: true): Exclude<T, undefined>;
  tap <T> (from: (this: this, state: this) => Promise<T>, expect?: boolean): T | undefined;

  tap <T> (from: (this: this, state: this) => T, expect: true): Exclude<T, undefined>;
  tap <T> (from: (this: this, state: this) => T, expect?: boolean): T;

  tap(path?: string | Function, expect?: boolean){
    return useTap(this, path, expect);
  }

  /**
   * **React Hook** - Subscribe to instance of controller within a component.
   *
   * @param callback - Run once before subscription begins.
   */
  use(callback?: (instance: this) => void){
    return useModel(this, callback);
  }

  /**
   * **React Hook** - Fetch most instance of this controller from context, if it exists.
   * 
   * @param required - If false, may return undefined.
   */
  static get <T extends typeof MVC> (this: T, required?: true): InstanceOf<T>;

  /**
   * **React Hook** - Fetch most instance of this controller from context.
   * 
   * @param required - Unless false, will throw where instance cannot be found.
   */
  static get <T extends typeof MVC> (this: T, required: boolean): InstanceOf<T> | undefined;

  /**
   * **React Hook** - Fetch specific value from instance of this controller in context.
   */
  static get <T extends typeof MVC, I extends InstanceOf<T>, K extends Model.Fields<I>> (this: T, key: K): I[K];

  static get <T extends typeof MVC> (this: T, required?: boolean){
    return useInContext(this, required);
  }

  /** 
   * **React Hook** - Fetch and subscribe to instance of this controller within ambient component.
   */
  static tap <T extends typeof MVC> (this: T): InstanceOf<T>;

  static tap <T extends typeof MVC, I extends InstanceOf<T>, K extends Model.Fields<I>> (this: T, key: K, expect: true): Exclude<I[K], undefined>;
  static tap <T extends typeof MVC, I extends InstanceOf<T>, K extends Model.Fields<I>> (this: T, key: K, expect?: boolean): I[K];

  static tap <T, M extends typeof MVC, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => Promise<T>, expect: true): Exclude<T, undefined>;
  static tap <T, M extends typeof MVC, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => Promise<T>, expect?: boolean): T;

  static tap <T, M extends typeof MVC, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => T, expect: true): Exclude<T, undefined>;
  static tap <T, M extends typeof MVC, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => T, expect?: boolean): T;

  static tap <T extends typeof MVC> (key?: string | Function, expect?: boolean): any {
    return useTap(this.get(), key, expect);
  }

  /**
   * **React Hook** - Spawn and maintain a controller from within a component.
   * 
   * More efficient than `use()` if you don't need hook-based features.
   * 
   * @param callback - Run after creation of instance.
   */
  static new <T extends typeof MVC> (this: T, callback?: (instance: InstanceOf<T>) => void){
    return useNew(this, callback);
  }

  static use <T extends typeof MVC> (this: T, callback?: (instance: InstanceOf<T>) => void){
    const instance = useModel(this, callback);
    usePeerContext(instance.get);    
    return instance;
  }

  static uses <T extends typeof MVC, I extends InstanceOf<T>, D extends Partial<I>> (this: T, data: D, only?: (keyof D)[]){
    return this.use(instance => {
      instance.import(data, only);
    })
  }

  static using <T extends typeof MVC, I extends InstanceOf<T>, D extends Partial<I>> (this: T, data: D, only?: (keyof D)[]){
    const instance = this.use();
    instance.import(data, only);
    return instance;
  }

  static meta <T extends typeof MVC>(this: T): T;

  static meta <T extends typeof MVC, K extends keyof T> (this: T, key: K, expect: true): Exclude<T[K], undefined>;
  static meta <T extends typeof MVC, K extends keyof T> (this: T, key: K, expect?: boolean): T[K];

  static meta <T, M extends typeof MVC> (this: M, from: (this: M, state: M) => Promise<T>, expect: true): Exclude<T, undefined>;
  static meta <T, M extends typeof MVC> (this: M, from: (this: M, state: M) => Promise<T>, expect?: boolean): T;

  static meta <T, M extends typeof MVC> (this: M, from: (this: M, state: M) => T, expect: true): Exclude<T, undefined>;
  static meta <T, M extends typeof MVC> (this: M, from: (this: M, state: M) => T, expect?: boolean): T;

  static meta <T extends typeof MVC> (path?: string | Function, expect?: boolean): any {
    return useTap(() => this, path, expect);
  }
}