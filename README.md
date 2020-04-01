**interesting configurations**

- 03.png, local.json, CHUNK_SIZE=1221 TIMEOUT=0 DONE_TIMEOUT=200

**instances**

- a (second instance, receives config, does not read input file)
- b (main instance, sends config, reads input file)

**running**

		host-a $ ./start-remote a
		host-b $ ./start-remote b sketch/03.png

**running locally**

		$ ./start-local sketch/03.png

**convert pngs**

		$ ffmpeg -i <input.png> <output.png>
