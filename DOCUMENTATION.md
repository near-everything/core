# creating your own everything

1. FORK everything!!
Fork the [Everything widget](https://temp.everything.dev/#/evrything.near/widget/Everything)

You'll see that the widget looks like this:
```js
return (
  <Widget
    src="evrything.near/widget/Everything.Template"
    props={{
      accountId: "evrything.near", // which account's Types to use (your near account)
      font: "Times New Roman", // select a web safe font
      text: "everything", // main title
      domain: "everything", // domain data should be saved to
    }}
  />
);
```


All it does is provide props to a widget called "[evrything.near/widget/Everything.Template]()"
(What is a widget?)

The props are described as:
  accountId: which accounts's Types to use (your near account)
  text: title on home page
  font: [web safe font]() the title should be in
  domain: where data should be saved to

So if I want to create a new "everything" that has dedicated types and it's own domain (I don't want this data to show up on the main everything feed), then I will do this:

```js
return (
  <Widget
    src="evrything.near/widget/Everything.Template"
    props={{
      accountId: "evrything-docs.near", // which account's Types to use (your near account)
      font: "Times New Roman", // select a web safe font
      text: "documentation", // main title
      domain: "everything-docs", // domain data should be saved to
    }}
  />
);
```

Now when I navigate to my widget, I see this:

(screenshot)

I see the + button because I created and own this "everything", so I can create Types on it.

Let's create a type:

Click the +. This will render the [Everything.Create.Type]() widget.
This widget is actually an application whos code repository is here:
Is deployed to an app here:
Is injected into an iframe here via near-social-bridge:

Multi dimensional apps!!



Let's create a "Document" Type:

Enter Type Name: Document

Then a couple of properties:
title of type String
body of type Markdown
author of type String

That should be enough for now.

Then publish type. You'll get a message like this:

```json
{
  "evrything-docs.near": {
    "type": {
      "Document": {
        "": "{\"properties\":[{\"name\":\"title\",\"type\":\"string\"},{\"name\":\"body\",\"type\":\"markdown\"},{\"name\":\"author\",\"type\":\"string\"}],\"widgets\":{\"summary\":\"evrything-docs.near/widget/Everything.Summary.Document\",\"view\":\"evrything-docs.near/widget/Everything.View.Document\",\"create\":\"evrything-docs.near/widget/Everything.Create.Document\"}}"
      }
    }
  }
}
```

Let's break this down a bit. We are saving a type to our account named Document
That had properties:
  title : string
  body : markdown
  author : string

Then references to three widgets:
  summary: evrything-docs.near/widget/Everything.Summary.Document
  view: evrything-docs.near/widget/Everything.View.Document
  create: evrything-docs.near/widget/Everything.Create.Document

We'll explore this widgets in a second.
Click publish, and after successful, you should see your new type on the main page:

(added documents)

If you click "documents", you'll see three buttons:

(documents-empty)

back, which will take you back to main page
view type details, which allows you to see the details of the type (WIP)
and create new, which will open the create widget referenced in the Type (evrything-docs.near/widget/Everything.Create.Document)

If you click create, it will say that widget is not found:

(create-not-found)

That means we need to create the widget. So let's go to the [editor]() and create a new widget name "Everything.Create.Document"

You can copy and paste from Everything.Create.Idea

This is a near-social-bridge component; you can think of it as the "backend" for the creator app you're about to build.

To build the creator app, create a new repository from the template [here](https://github.com/near-everything/thing-creator).

Name the repository your type-creator, so in this case "document-creator"

clone the repo to your computer
cd document-creator
pnpm i


In this repository, you only need to worry about a few things:

services/createThing : this is the method that sends the request to the social bridge to create your thing.

Change the "CreateThingPayload" to match your type:

```js
interface CreateThingPayload {
  title: string,
  body: string,
  author: string
}
```

components/CreatorForm : this is where you create your form that fits your type.

Add your fields to your state with methods to update
```js
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");

    const handleTitleChange = (event: { target: { value: any } }) => {
    setTitle(event.target.value);
  };

  const handleBodyChange = (event: { target: { value: any } }) => {
    setBody(event.target.value);
  };

  const handleAuthorChange = (event: { target: { value: any } }) => {
    setAuthor(event.target.value);
  };
```

Then add your inputs to the form in CreatorForm


Then deploy to vercel; make sure you change output directory to /dist



Elliot:
  Add "Document" type to Vercel
  Go to mesh and rebuild (yarn build)
  Push, wait for deploy


Then in bridge widget
Change external app

Change the mutation
Change the thingId reference
Change the index domain
Change the type



Test and create some data

Publish

Now when you go to your app, click documents and click " create new", your app will show up:

(create-documents)

Create some data:

(create-document-message)
You'll see a thing Id which is a reference to an external database
Then you'll see that this data will be indexed by the "Everything-docs" domain. And that this data has type "evrything-docs.near/type/Document", which is the type we just created.

Click submit



Now go to the main page, if the data was saved successfully and type is configured correctly, you'll see a not found

(summary-not-found)

Let's configure this widget now!

Go to the editor and create a new widget name "Everything.Summary.Document"

Make your changes, style it how you want, and submit. Now you should see it on the main page.



If you click the summary, you'll go to a View page and see an error like this:

(view-not-found)

Let's configure this widget now!

Go to the editor and create a new widget name "Everything.View.Document"

Make your changes, style it how you want, and submit. Now you should see it when you click the summary.


Now just customize them as you like!
Add more types, add more data, this is your "everything"!!!