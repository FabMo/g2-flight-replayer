# g2-flight-replayer
Replayer for fabmo flight recordings of G2 traffic.

# Overview
This is a script for replaying G2 "flight logs" to help reproduce timing sensitive issues that are observed with the G2 firmware for debugging and test.

flight logs are JSON formatted log files that record the traffic with a [G2](https://github.com/synthetos/g2) session.  They are produced by the [FabMo Engine](https://github.com/FabMo/FabMo-Engine)  The format is currently sort of a moving target.

# Installation
You need node.js.  You can just `npm install` to pull the node dependencies.

# Usage
To use on the command line:

```
node main.js --control=/dev/ttyUSB0 filename.json
```
## Command Line Arguments
`--control` specifies the control channel (or only channel for the case of single-serial-port replays) `--data` specifies the data channel.  `--skip` specifies an optional time rage to skip.

## Skipping Time
Because these replays are used to reproduce time-sensitive issue, often sessions need to be "fiddled with" for quite awhile before the artifact under study is observed.  You can skip a single block of time by specifying the start and end times (milliseconds) at the command line: `--skip=1000:1500` would skip all of the transactions between 1000 and 1500 ms, for example.
