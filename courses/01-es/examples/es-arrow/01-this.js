// 运行：node courses/01-es/examples/es-arrow/01-this.js
// 对比：普通函数 vs 箭头函数 的 this 指向

const team = {
  name: '大前端',
  members: ['Alice', 'Bob'],

  // 普通方法：this 指向 team
  listWithArrow() {
    console.log('--- 箭头函数回调（this 正确）---');
    this.members.forEach((m) => console.log(`${m} in ${this.name}`));
  },

  listWithNormal() {
    console.log('--- 普通函数回调（this 丢失）---');
    this.members.forEach(function (m) {
      // 这里 this 不再是 team
      console.log(`${m} in`, this === undefined ? 'undefined(模块严格模式)' : this);
    });
  },
};

team.listWithArrow();
team.listWithNormal();
