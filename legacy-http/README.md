# 旧的 HTTP 后端（目前没接上）

`Code.gs`（Google Apps Script）和 `run_local.js`（本机 Node）是早期的做法：
手机打 `/api`，分数存在伺服器。`Code.gs` 里有 18 项自我测试，但数字是旧的（起手 10、市场 +5、没有风暴），跟现在的 `index.html` 不同。

**现在的 `index.html` 已经不走这条路**，改成大屏幕当主机、手机走公共中继，
不需要伺服器。这两个档案留着备用，需要「同一个 WiFi、完全不靠外面服务」的版本时再接回来。

`run_local.js` 现在只会把上一层的 `index.html` 送出来当静态档，`/api` 没有人在用。
