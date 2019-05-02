/**
 * Mutates the given object to recursivly resolves references.
 */
function mergeRefs(root: any) {
  const { _refs, ...data } = root;
  if (_refs) {
    const walk = (obj: any) => {
      if (!obj) return;
      if (typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        obj.forEach(walk);
        return;
      }
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (key === "_ref") {
          const id = obj._id;
          const refs = _refs[value];
          if (!refs || !id) return;

          const type: string | undefined = obj[`_${value}`];
          const lookup = type ? refs[type] : refs;
          if (!lookup) return;

          const ref = lookup[id];
          if (ref) {
            walk(ref);
            Object.assign(obj, ref);
          }
        }
        walk(value);
      });
    };
    walk(data);
  }
  return data;
}
