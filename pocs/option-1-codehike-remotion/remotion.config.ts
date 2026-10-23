import { Config } from "@remotion/cli/config";

// Small, unattended renders: the POC box is shared and has 8 GB of RAM.
Config.setConcurrency(2);
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setCrf(28);
// The committed ElevenLabs takes are the only static files (staticFile()).
Config.setPublicDir("narration");
