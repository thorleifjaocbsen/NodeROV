// simple-worker.js
import { Worker, isMainThread, threadId } from 'worker_threads'

if (isMainThread) {
  // This loads the current file inside a Worker instance.
  console.log('inside main thread')
  new Worker('./test.js')
} else {
  console.log('inside worker', threadId)
}