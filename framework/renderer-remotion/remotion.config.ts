import { Config } from "@remotion/cli/config";

// Defaults for `remotion studio` and any ad-hoc CLI run from this directory.
// scripts/render.mjs and scripts/stills.mjs pass the same values as flags.
Config.setConcurrency(2); // required on the shared 4 vCPU / 8 GB box
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setCrf(28);
Config.setAudioBitrate("128k"); // Remotion's default (~320k) would double the file
