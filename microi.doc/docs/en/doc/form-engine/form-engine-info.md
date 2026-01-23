# Introduction to the form engine
## This document may give readers a more novel view of the "form engine": "Can the original form engine still play like this?"
> perhaps most students think that "form engine" is the basic function of low code, which is nothing to blow.
> but Microi code has achieved "everything is a form engine" and a black technology

## "Everything is a form engine"
> The "consequence" of this is that only **login** and **desktop** are custom development pages for the entire low-code platform, and all other pages are driven by the form engine (or interface engine).

## Module Engine is driven by the form engine
> The module engine is the "system menu configuration" commonly understood, including basic menu configuration, data source configuration, more button configuration, and replacement configuration.
> Advantages: You can use the form engine to design the module engine and freely add configuration items.
> for example, some time ago, teacher Liu needed to add a configuration item of "whether App is displayed" to the "menu configuration" and solve it in 10 seconds.
<img src="https://static.itdos.com/upload/img/csdn/012ef3417a0edefe280ed22972b4bc32.png" />
<img src="https://static.itdos.com/upload/img/csdn/7197b448e310da3e0945937664f0047f.png" />

## "Process Engine" is driven by a form engine
> The process attributes and node attributes of the process engine are also driven by the form engine
> The advantage of this is that developers can freely add configurable items for processes and nodes.
> For example, we want to add a custom configuration "" to the node attribute, which only takes 10 seconds.
<img src="https://static.itdos.com/upload/img/csdn/812c3691ce7b2c7e9965accfc605891e.png">

## "Interface Engine" is driven by the form engine
> * Interface engine is one of the features of Microi's code platform. It uses javascript syntax to write any complex business logic online, which is suitable for large-scale ERP, Internet and other projects.
> * Developers are free to add configurable items to the interface engine, such as: interface call frequency limit?
<img src="https://static.itdos.com/upload/img/csdn/0fccb24ace37b9b36f8f9de801fb7d90.png">

## "SaaS engine" is driven by a form engine
> The SaaS engine includes independent configurations of the tenant's database, Alibaba Cloud, MinIO, Redis, MQ, and search engine.
> developers are free to add new configurations, such as: tenants are allowed to log in?
<img src="https://static.itdos.com/upload/img/csdn/a16ab7aabec6834dff731d4db4b457d2.png">

## The "form engine" is also driven by the form engine
> Here comes the highlight: the form engine is also driven by the form engine! That is, the form engine list, form properties, and field properties are also driven by the form engine.
> it is also difficult for bloggers to use words to explain in detail, and a video will be released later.
<img src="https://static.itdos.com/upload/img/csdn/f4ead7346e69b9d362e50d3aafb9dcfe.png">

## There are many more such as task scheduling, MQ, etc. are driven by the form engine.
> later supplement

## Black Technology
## Expanding Form Components
> The form engine component library supports free expansion of secondary development. For example, I want to add a "display weather" component.
<img src="https://static.itdos.com/upload/img/csdn/9a37d32ab119cf8d9a8eee9230d916c2.png">
## Customizing Form Components
> vue components developed by oneself can be embedded in form design
> The embedded vue component can also call the form engine with a code <DiyForm TableId = "1" />
<img src="https://static.itdos.com/upload/img/csdn/e67595311cdb3119244fc6ed0edb3a93.png">

## Secondary development reference form component
> as shown in the figure: customize and develop a more complex page, which can be edited or added by calling the form designed by the form engine through a code.
<img src="https://static.itdos.com/upload/img/csdn/caa80acf3b86e28ff78cd74514982a36.png">

## Powerful V8.FormEngine
* See CSDN article:[https://microi.blog.csdn.net/article/details/143623519](https://microi.blog.csdn.net/article/details/143623519)

## Rich V8 Events
> The platform provides a very rich front-end events, back-end events, keyboard events, value change events, etc.
> for example, before the form is submitted, judge which fields are required and which fields do not conform to the rules in the "front-end event"
> For example, before the form is submitted, more stringent data verification is judged in the "back-end event" to prevent the front-end verification from being bypassed through the postman call interface.
> Related CSDN Articles:[https://microi.blog.csdn.net/article/details/143623205](https://microi.blog.csdn.net/article/details/143623205)

## Dynamic Association Form
> for example, in the commodity information, my commodity may be a water dispenser or a computer.
> and drinking fountain I need to fill in the water outlet mode, tap, water production capacity and other information
> and the computer I need to fill in CPU, memory, graphics and other information
> At this point, you can use the dynamic association form, design multiple form engines for commodity classification, and then dynamically call
<img src="https://static.itdos.com/upload/img/csdn/a405352e6078d8868a6e42d7a12aca31.png">

