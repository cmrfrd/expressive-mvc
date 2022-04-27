import { Model } from './model';
import { BunchOf } from './types';
import { create, defineProperty, getOwnPropertyDescriptor, getOwnPropertySymbols, getPrototypeOf, values } from './util';

export type Collection =
  | Array<Model | typeof Model>
  | BunchOf<Model | typeof Model>;

export class Lookup {
  private table = new Map<typeof Model, symbol>();

  public get local(){
    return [
      ...new Set(getOwnPropertySymbols(this).map(
        symbol => (this as any)[symbol] as Model
      ))
    ]
  }

  private key(T: typeof Model){
    let key = this.table.get(T);

    if(!key){
      key = Symbol(T.name);
      this.table.set(T, key);
    }

    return key;
  }

  public get(T: typeof Model){
    return (this as any)[this.key(T)];
  }
  
  public push(I: Model | typeof Model | Collection){
    const next = create(this) as this;

    if(I instanceof Model || typeof I == "function")
      next.register(I);
    else
      for(const i of values(I))
        next.register(i);

    return next;
  }

  public register(I: Model | typeof Model){
    let writable = true;
    let T: typeof Model;

    if(I instanceof Model){
      T = I.constructor as any;
      writable = false;
    }
    else {
      T = I;
      I = I.create();
    }

    do {
      const key = this.key(T);
      const conflict = this.hasOwnProperty(key);

      defineProperty(this, key, {
        value: conflict ? null : I,
        configurable: true,
        writable
      });

      T = getPrototypeOf(T);
    }
    while(T !== Model);

    return I;
  }

  public pop(){
    for(const key of getOwnPropertySymbols(this)){
      const entry = getOwnPropertyDescriptor(this, key)!;

      if(entry.writable && entry.value)
        entry.value.destroy();
    }
  }
}