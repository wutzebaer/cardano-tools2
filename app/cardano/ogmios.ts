import {
  createConnectionObject,
  getServerHealth,
} from "@cardano-ogmios/client";

const connection = createConnectionObject({ host: "localhost", port: 1337 });
export const getHealth = async () => {
  return getServerHealth({ connection });
};
