/** Adapta os sistemas solo existentes sem duplicar sua IA ou suas animações. */
export function soloContext(scene, fields = {}, isolated = false, owner = null) {
  const own = Object.defineProperties({ multiplayer: false }, Object.getOwnPropertyDescriptors(fields));
  const add = new Proxy(scene.add, { get(target, key) {
    const value = target[key];
    if (typeof value !== "function") return value;
    return (...args) => {
      const object = value.apply(target, args);
      if (owner && object) object.coopOwner = owner;
      return object;
    };
  } });
  return new Proxy(own, {
    get(target, key) {
      if (key === "add") return add;
      if (Object.prototype.hasOwnProperty.call(target, key)) return Reflect.get(target, key);
      const value = scene[key];
      return typeof value === "function" ? value.bind(scene) : value;
    },
    set(target, key, value) {
      return Reflect.set(isolated || Object.prototype.hasOwnProperty.call(target, key) ? target : scene, key, value);
    },
    defineProperty(target, key, descriptor) {
      return Reflect.defineProperty(isolated ? target : scene, key, descriptor);
    },
    deleteProperty(target, key) { return Reflect.deleteProperty(isolated ? target : scene, key); },
  });
}
