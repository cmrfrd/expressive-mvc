export {
  childProperty as use,
  peerProperty as get,
  effectProperty as set,
  refProperty as ref,
  eventProperty as event,
  componentProperty as hoc,
  parentComponentProperty as wrap,
  memoizedProperty as memo
} from './directives';

export {
  Controller,
  Controller as VC,
  Controller as default
} from './controller';

export {
  Singleton,
  Singleton as GC
} from './singleton';

export {
  InsertProvider as Provider
} from './context';