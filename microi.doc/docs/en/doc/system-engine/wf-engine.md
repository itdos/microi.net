# Process Engine, Workflow Engine
## Foreword
> **First Edition**：In 2008, the blogger took over the workflow engine developed by his former colleagues based on Microsoft WWF and developed OA systems and ERP systems for more than 10 state-owned enterprises and institutions.

> **Second Edition**：The blogger participated in the secondary development and bug repair of ccflow workflow engine in 2012. He was once the super moderator of ccflow forum and used Microsoft SelverLight technology at that time (unfortunately, he was eliminated). Zhou Zong, the boss of ccflow, is also our predecessor. At present, the open source ccflow workflow engine is still under maintenance and recommend strong attention.

> **Third Edition**：In 2014, at the request of the company, the blogger used Microsoft's latest WWF independently developed the third edition of the workflow engine, cooperated with AvalonJs UEditor to develop a low-code platform, and applied dozens of state-owned enterprises, institutions and measurement units.

> **Fourth Edition: Bloggers Use Microi's Code Form Engine to Drive Workflow Engine in 2018. NET core Vue completely self-developed the 4th generation workflow engine (since Microsoft WWF does not support. net core, so self-developed)**


## Advantages of the fourth generation workflow engine
>* Process attributes and node attributes are driven by the form engine for greater flexibility.
>* Rich front-end events and back-end events to meet complex business needs
>* With the integrated front and rear V8 engines, there are no complex scenes that cannot be realized.
>* The process engine is decoupled from the business form, which can integrate third-party forms and secondary development.
>* [The source code of the process designer is completely open source in the personal version of Microi Code (difference between open source version/personal version/enterprise version:[https://microi.net/microi-price](https://microi.net/microi-price)）
>* At present, process business management has been applied to hundreds of customers.

## Preview
![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/8060a3f2a84d4b379efe57e869027598.png#pic_center)
# Description of physical tables related to the process engine
WF_FlowDesign: Flowchart design table, a flowchart corresponds to a piece of data.
> **WF_Node**: process node attribute table
> **WF_Line**: process condition (line) attribute table
> **WF_Flow**: The process instance table. When a process is initiated, one piece of instance data is generated. One piece of instance data corresponds to N pieces of work data in the WF_Work table.
> **WF_Work**: the process work to-do table. If a process instance is initiated, three to-do tables are generated and three WF_Work data are written.
> **WF_History**: process track table, a detailed record of each step of the process and all actions of each person, such as consent, rejection, withdrawal, etc.

## V8 Event Order
> 1. User clicks to initiate a process or process a job
> 2. form entry event V8 (front end)
> 3. The user clicks the [Submit] button
> 4. **Node Start Event V8 (Front End)**
> 5. event V8 before form submission (front end)
> 6. Pre-form submission event V8 (backend)
> 7. Event V8 after form submission (backend)
> 8. event V8 after form submission (front end)
9. Call the back-end processing work interface.
> 10. **Condition judgment V8 (back end)**
> 10. **Node Start Event V8 (Backend)**
> 11. **Node End Event V8 (Backend)**
> 12. **Node end event V8 (front end)**

## All event accessible built-in functions
> **V8.WF.ApprovalType**: The approval type clicked by the user. Possible values: 'Auto' (initiate process (start node)/business node), 'Agree', 'Disagree', 'Recall'
> **V8.WF.ApprovalIdea**: Approval comments filled in by the user
> **V8.WF.AddUsers**: Approver added by user
> **V8.WF.SelectUsers**: User selected approver
> **V8.WF.CurrentFlowDesign**: Current Process Design Entity
> **V8.WF.CurrentNode**: Current node entity
> **V8.WF.BackNodeId**: If the user clicks Reject and selects which node to return to, this is the node Id

## Node Start Event V8 (Front End)
```javascript
if(V8.Form.Money > 1000){
  V8.Tips('金额不能大于1000！', false);//前端提示
  V8.Result= false;//阻止表单和流程提交
}
//金额加1
V8.Form.Money = V8.Form.Money + 1;
//强制指定下一节点审批人
V8.WF.ForceSelectUsers=['userid'];
//这里可以还执行大部分V8内置函数，如同步接口请求等
```
## Node Start Event V8 (Backend)
> Can use V8.Result = { Code : 0, Msg: 'prevent process commute'}; Rollback transaction, prevent process commit
## Condition judgment V8 (back end)
```javascript
//在服务器端执行
//这里赋值LineValue就是条件属性设置的【条件值】
if(V8.Form.Money <= 100){
  V8.LineValue = 1;
}else{
  V8.LineValue = 2;
}
```
## Node end event V8 (front end)
> **V8.WF.WorkResult**: the data returned after the process is successfully executed, such as the node to which it is sent and the approvers.
## Node End Event V8 (Backend)
> **V8.WF.NextNode**: Access the next node entity
> **V8.WF.NextTodoUsers**: Access Recipient, format:[{Id:'',Name:''}]

## Withdrawal
>* After node A is submitted to node B and before node B approves, the submittee of node A can voluntarily withdraw it to himself at any time, edit the form data again and submit it again.
>* After node B approves, node A cannot withdraw, but node B can withdraw to its own node B before node C approves.
>* Node A really wants to withdraw again, but only node C refuses and returns to node A.
>* Note: When withdrawing, the node start V8 and end V8 will also be executed.
>* In the future, it is also possible to add to the process attribute that the submiter can withdraw at any time.

## Function introduction
## My to-do
Get the WF_Work table, waiting for me to process the work.
## I initiated
> Get the WF_Flow table, I initiated the process instance.
## I dealt
Get the WF_Work table that I 've dealt.
> The reason why I do not get the work I process from the WF_Flow table is to realize the field permission control of each node and to realize the recall function.
## CC my
Get the WF_History table, cc sent to my work.
> The reason why I don't get the CC from the WF_Flow table is to realize the field permission control of each node.
## I'm related
> Get the WF_Work table, I received the pending work, but not the work handled by me.
## All instances
> Administrator permission, obtain all process instances initiated by the owner in the WF_Flow table (non-work)
# Related Screenshots
![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/c688b2d1487b49448aca89ada673e211.png#pic_center)

## Related V8
```javascript
//将某条数据打开Form表单并可以发起流程，第三个object参数若不传，即为查看流程
V8.OpenFormWF(V8.Form, 'Edit', {
	//StartWork：发起流程，ViewWork：查看流程。当为ViewWork时，可以不传FlowDesignId
    WorkType:'StartWork',
    FlowDesignId:'',//流程图Id
});
```
## Thanks for browsing