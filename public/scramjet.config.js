self.__scramjet$config = {
  prefix: "/scramjet/",
  codec: "xor",
  flags: {
    serviceworkers: true,
    captureErrors: true,
    syncxhr: true,
    websocket: true,
  },
  defaultFlags: {
    "open window": true,
  },
};
