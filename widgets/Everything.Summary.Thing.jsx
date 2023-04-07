const Card = styled.div`
  height: 420px;
  background-color: white;
  padding: 12px;
  margin: 8px;
  border-radius: 5px;
  border: 1px solid #ccc;
  box-shadow: 0 0 7px 0 #ddd;
`;
const Header = styled.div`
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
`;
const Title = styled.div`
    font-size: 24px;
    line-height: 33.6px;
`;
const Icon = styled.div`
  height: 24px;
  width: 24px;
`;
const Body = styled.div`
  margin-left: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;
const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const Preview = styled.div`
    font-size: 16px;
    line-height: 20.8px;
    color: #A6A6A6;
    overflow: hidden;
    position: relative;
    text-overflow: ellipsis;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 8;
    -webkit-box-orient: vertical;
`;
const Caption = styled.div`
    font-size: 12px;
    line-height: 15.6px;
    color: #A6A6A6;
`;

const thingId = props.data.thingId;

if (thingId === null) {
  return (
    <Widget
      src={ERROR_WIDGET}
      props={{
        message: "thing id was not provided.",
      }}
    />
  );
}

const data = fetch("https://monkfish-app-ginhc.ondigitalocean.app/graphql", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query:
      "query findIdeaByThingId($thingId: ID) { findIdeas(id: {is: $thingId}) { name, description { md }, creationDate } }",
    variables: {
      thingId: thingId,
    },
  }),
});

if (data.body.errors) {
  return (
    <Widget
      src={ERROR_WIDGET}
      props={{
        message: JSON.stringify(data.body.errors[0].message),
      }}
    />
  );
}

data = data.body.data.findIdeas[0];

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString();
  return `${day}.${month}.${year}`;
};

return (
  <Card>
    <div className="d-flex flex-row h-100">
      <Icon>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15.26 22C15.2 22 15.13 21.99 15.07 21.97C13.06 21.4 10.95 21.4 8.94003 21.97C8.57003 22.07 8.18003 21.86 8.08003 21.49C7.97003 21.12 8.19003 20.73 8.56003 20.63C10.82 19.99 13.2 19.99 15.46 20.63C15.83 20.74 16.05 21.12 15.94 21.49C15.84 21.8 15.56 22 15.26 22Z"
            fill="#292D32"
          />
          <path
            d="M19.21 6.36001C18.17 4.26001 16.16 2.71001 13.83 2.20001C11.39 1.66001 8.88997 2.24001 6.97997 3.78001C5.05997 5.31001 3.96997 7.60001 3.96997 10.05C3.96997 12.64 5.51997 15.35 7.85997 16.92V17.75C7.84997 18.03 7.83997 18.46 8.17997 18.81C8.52997 19.17 9.04997 19.21 9.45997 19.21H14.59C15.13 19.21 15.54 19.06 15.82 18.78C16.2 18.39 16.19 17.89 16.18 17.62V16.92C19.28 14.83 21.23 10.42 19.21 6.36001ZM13.72 11.62L12.65 13.48C12.51 13.72 12.26 13.86 12 13.86C11.87 13.86 11.74 13.83 11.63 13.76C11.27 13.55 11.15 13.09 11.35 12.74L12.2 11.26H11.36C10.86 11.26 10.45 11.04 10.23 10.67C10.01 10.29 10.03 9.83001 10.28 9.39001L11.35 7.53001C11.56 7.17001 12.02 7.05001 12.37 7.25001C12.73 7.46001 12.85 7.92001 12.65 8.27001L11.8 9.75001H12.64C13.14 9.75001 13.55 9.97001 13.77 10.34C13.99 10.72 13.97 11.19 13.72 11.62Z"
            fill="#292D32"
          />
        </svg>
      </Icon>
      <Body>
        <Content>
          <Title>{data.name}</Title>
          <Preview>
            <Markdown text={data.description.md} />
          </Preview>
        </Content>
        <Caption>{formatDate(data.creationDate)}</Caption>
      </Body>
    </div>
  </Card>
);
