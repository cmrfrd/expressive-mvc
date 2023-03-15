import { Model } from '..';
import { getParent } from '../children';
import { issues } from '../helper/issues';
import { Register } from '../register';
import { useLookup } from './useContext';

export const Oops = issues({
  AmbientRequired: (requested, requester) =>
    `Attempted to find an instance of ${requested} in context. It is required by ${requester}, but one could not be found.`
});

const Pending = new WeakMap<{}, ((context: Register) => void)[]>();
const Applied = new WeakMap<Model, boolean>();

function getForGetInstruction<T extends Model>(
  type: Model.Type<T>,
  from: Model,
  required: boolean
){
  let item = getParent(type, from);

  return (refresh: (x: T) => void) => {
    if(item)
      return item;

    getPending(from).push(context => {
      let got = context.get<T>(type);

      if(got){
        item = got;
        refresh(got);
      }
      else if(required)
        throw Oops.AmbientRequired(type.name, from);
    })
  }
}

function usePeerContext(subject: Model){
  if(Applied.has(subject)){
    if(Applied.get(subject))
      useLookup();

    return;
  }

  const pending = Pending.get(subject);

  if(pending){
    const local = useLookup();

    for(const init of pending)
      init(local);

    Pending.delete(subject);
  }

  Applied.set(subject, !!pending);
}

function getPending(subject: {}){
  let pending = Pending.get(subject);

  if(!pending)
    Pending.set(subject, pending = []);

  return pending;
}

export {
  getForGetInstruction,
  usePeerContext,
  getPending
}