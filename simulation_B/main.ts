import { getRandomInt } from "./util/util";
import Worker from "./class/worker";
import Manager from "./class/manager";
import Task from "./class/task";
import Market from "./class/market";
import Stock from "./class/stock";
import Order from "./class/order";

//
// 試行回数
//
const tryNum: number = 10000;
const workerNum: number = 5;
const taskNum: number = 3;

//
// workerの生成
//
const workers: Worker[] = [];
for (let i = 0; i < workerNum; i++) {
  const w: Worker = new Worker(i, i * 10 + 10);
  workers.push(w);
}

//
// workerのppのランダム生成
//
workers.forEach((w) => w.initializePerceivedPotentials(workers));

//
// 変数の定義
//
const stocks: Stock[] = workers.map((w: Worker) => new Stock(w.id));
const market: Market = new Market(stocks);
const manager: Manager = new Manager(workerNum + 1);
const overallSuccessRates = [];

//
// 初期の株配分
//
const totalIssueNum = 1000;
const portionNum = totalIssueNum / workerNum;

// TODO 初期の株配分を実装
for (const stock of stocks) {
  for (let i = 0; i < workerNum; i++) {
    const randIndex = getRandomInt(0, workerNum - 1);
    const worker = workers[randIndex];
    stock.issue(worker.id, portionNum);
  }
}

try {
  market.start();

  for (let i = 0; i < tryNum; i++) {
    const totalPrice: number = stocks
      .map((s: Stock) => s.latestPrice)
      .reduce((v: number, sum: number) => sum + v);

    const tasks: Task[] = [];
    for (let v = 0; v < taskNum; v++) {
      // TODO valueの合計値をtaskの総数で割った数が最大値の乱数にした理由をまとめる
      const threshold: number = getRandomInt(10, totalPrice / taskNum);
      const task: Task = new Task(v, manager, threshold);
      tasks.push(task);
    }

    manager.assignWorkersToTasks(workers, tasks, market);

    for (const task of tasks) {
      // taskが終了してworkerにpotentialがpopulateされる
      task.end();
    }

    const successfulTasks: Task[] = tasks.filter((t: Task) => t.isCompleted());
    const successRate: number = (successfulTasks.length / tasks.length) * 100;
    overallSuccessRates.push(successRate);

    for (const w of workers) {
      for (const entry of w.perceivedPotentials.entries()) {
        const workerId: number = entry[0];
        const perceivedPotential: number = entry[1];
        const stock: Stock = market.stocks.get(workerId);
        const orders: Order[] = market.orders.get(stock.id);

        // TODO perceivedPotentialだけでなく、将来的にcoinを増やそうとするインセンティブをシステムに組み込まないといけない
        // TODO 正しいpotentialを知っているひとだけでなく正しくないpotentialを持っている人が参加するため、valueがpotentialに近似しない
        if (stock.latestPrice < perceivedPotential) {
          // TODO 値動きを表現する
          // TODO 買い注文を出す
          // TODO 売り注文を見て、良さそうなorderがあったらそれと同じpriceにして注文する
          // TODO なかったらlatestPrice + 1
          let order: Order = new Order(
            stock.id,
            w.id,
            "ask",
            stock.latestPrice + 1,
            1 // TODO 買えるだけかう
          );

          const index = orders
            .sort((a, b) => (a.price < b.price ? -1 : 1))
            .findIndex((o) => o.type == "bid" && o.price < perceivedPotential);
          if (index !== -1) {
            order = new Order(
              stock.id,
              w.id,
              "ask",
              orders[index].price,
              1 // TODO 買えるだけかう
            );
          }
          market.setOrder(order);
          continue;
        }

        // 持っていないと売れない
        if (
          stock.latestPrice > perceivedPotential &&
          stock.balanceOf(w.id) > 0
        ) {
          // TODO 売り注文を出す
          // TODO 買い注文を見て、良さそうなorderがあったらそれと同じpriceにして注文する
          // TODO なかったらlatestPrice - 1
          let order: Order = new Order(
            stock.id,
            w.id,
            "bid",
            stock.latestPrice - 1,
            1 // TODO 買えるだけかう
          );

          const index = orders
            .sort((a, b) => (a.price > b.price ? -1 : 1))
            .findIndex((o) => o.type == "ask" && o.price > perceivedPotential);
          if (index !== -1) {
            order = new Order(
              stock.id,
              w.id,
              "bid",
              orders[index].price,
              1 // TODO 買えるだけかう
            );
          }
          market.setOrder(order);
          continue;
        }
      }
    }

    //console.log(market.orders);
  }
} catch (e) {
  console.error(e);
}

// このままだとorderがなくならず増えるだけ
// 売り注文と買い注文をどのようにマッチさせるのか
// 最初は注文した分だけ買える
// 買える分だけ買う？
// coinの概念をどうするか

const overallSuccessRate: number =
  overallSuccessRates.reduce((r, sum) => sum + r) / overallSuccessRates.length;
// 全タスクの成功率の平均
console.log(overallSuccessRate);

workers.forEach((w) => {
  const s = market.stocks.get(w.id);
  console.log(`${w.id}: potential ${w.potential}, value ${s.latestPrice}`);
});
