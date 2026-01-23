# JS処理浮動小数点数計算精度問題
> * 【システム設定】->【開発構成】->【グローバルフロントエンドv 8エンジン、グローバルサーバー側v 8エンジン】に、浮動小数点精度の問題を処理するカスタムcalc関数を追加します
```js
function calc(operation, ...numbers) {
    const multipliers = numbers.map(num => {
        const decimal = num.toString().split('.')[1];
        return decimal ? Math.pow(10, decimal.length) : 1;
    });
    
    const maxMultiplier = Math.max(...multipliers);
    const results = numbers.map(num => num * maxMultiplier);
    
    let result;
    switch(operation) {
        case '+': result = results.reduce((sum, curr) => sum + curr, 0); break;
        case '-': result = results.reduce((diff, curr, i) => i === 0 ? curr : diff - curr); break;
        case '*': result = results.reduce((product, curr) => product * curr, 1); break;
        case '/': result = results.reduce((quotient, curr, i) => i === 0 ? curr : quotient / curr); break;
        default: throw new Error('Unsupported operation');
    }
    
    return result / (operation === '*' ? Math.pow(maxMultiplier, numbers.length) : 
                 operation === '/' ? Math.pow(maxMultiplier, numbers.length - 1) : maxMultiplier);
}
```
> * 使い方
```js
//计算：0.005-0.002-0.0007
var a = calc('-', 0.005, 0.002, 0.00007);
//计算： (0.005-0.002)*2.2*(0.003-0.002)
var b = calc('*', calc('-', 0.005, 0.002), 2.2, calc('-', 0.003, 0.002));
```