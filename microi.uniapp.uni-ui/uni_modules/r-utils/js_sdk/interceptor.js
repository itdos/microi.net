/*
 * @Description: 
 * @Author: iRainna
 * @Date: 2023-08-07 11:03:38
 * @LastEditTime: 2023-08-07 11:05:11
 * @FilePath: \i-r-ui\uni_modules\iR-ui\libs\utils\interceptor.js
 */
import { noop, isPromise } from "./basic.js";
export function callInterceptor(interceptor, { args, done, canceled }) {
  if (interceptor) {
    const returnVal = interceptor.apply(null, args);

    if (isPromise(returnVal)) {
      returnVal
        .then((value) => {
          if (value) {
            done();
          } else if (canceled) {
            canceled();
          }
        })
        .catch(noop);
    } else if (returnVal) {
      done();
    } else if (canceled) {
      canceled();
    }
  } else {
    done();
  }
}
