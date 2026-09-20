// 运行：node courses/02-typescript/examples/ts-union/01-narrow.ts
type Result =
  | { status: 'loading' }
  | { status: 'success'; data: string }
  | { status: 'error'; code: number };

function describe(r: Result): string {
  switch (r.status) {
    case 'loading': return '加载中...';
    case 'success': return '成功: ' + r.data;
    case 'error':   return '错误码: ' + r.code;
  }
}
console.log(describe({ status: 'success', data: 'hello' }));
console.log(describe({ status: 'error', code: 404 }));
