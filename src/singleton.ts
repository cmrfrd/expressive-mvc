import { Controller } from './controller';
import { defineOnAccess } from './util';

export class Singleton extends Controller {
  destroy(){
    super.destroy();

    const constructor = 
      this.constructor as typeof Singleton;

    if(this !== constructor.current)
      console.warn(
        `${constructor.name}.destory() was called on an instance which is not active. ` +
        `This is an antipattern and may caused unexpected behavior.`
      )
    else
      constructor.current = undefined;
  }

  attach(key: string, type: typeof Controller){
    if(!type.context)
      defineOnAccess(this, key, () => type.find());
      
    else throw new Error(
      `Singleton '${this.constructor.name}' attempted to attach '${type.name}'. ` +
      `This is not possible because '${type.name}' is not also a singleton.`
    )
  }

  static current?: Singleton = undefined;

  static find(){
    const instance = this.current;

    if(!instance){
      const { name } = this;
      throw new Error(
        `Tried to access singleton ${name} but one does not exist! Did you forget to initialize?\n\n` +
        `Call ${name}.create() before attempting to access, or consider using ${name}.use() here instead.`
      )
    }

    return instance;
  }

  static create<T extends Class>(
    this: T,
    args: any[], 
    prepare?: (self: any) => void){

    const Type = this as unknown as typeof Singleton;
    let instance = Type.current as InstanceType<T>;

    if(instance)
      throw new Error(
        `Shared instance of ${this.name} already exists!\n` +
        `'${this.name}.use(...)' may only be mounted once at any one time.`
      )

    instance = super.create(args, prepare) as any;
    Type.current = instance;
    
    return instance;
  }
  
  static delete(instance?: Singleton){
    const constructor = instance 
      ? instance.constructor as typeof Singleton
      : this;

    if(!instance)
      instance = this.current;
    else 
      
    if(!instance)
      return;

    delete constructor.current;
  }

  static extends<T extends Class>(
    this: T, type: Class): type is T {

    return type.prototype instanceof this;
  }

  static get context(): any {
    return undefined;
  }

  static get Provider(): any {
    throw new Error(
      `Controller ${this.name} is tagged as global. Context API does not apply.`
    )
  }
}