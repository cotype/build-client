import { Api } from "./Api";

const _fetch = jest.fn(() =>
  JSON.stringify({
    name: "Category A",
    slug: "a",
    contacts: [
      {
        role: "admin",
        contact: {
          _id: "23",
          _ref: "content",
          _content: "Contact"
        }
      }
    ],
    _refs: {
      content: {
        Contact: {
          "23": {
            name: "Felix",
            email: "felix@example.com",
            other: "some value"
          }
        }
      }
    }
  })
);

const api = new Api();
(api as any)._fetch = _fetch;

it("should join contacts", async () => {
  const res = await api.loadCategory("id");
  expect(_fetch).toHaveBeenCalledWith(
    "/category/id?join[Contact][0]=name&join[Contact][1]=email",
    { headers: { Accept: "application/json" } }
  );
  expect(res).toMatchObject({
    contacts: [{ role: "admin", contact: { name: "Felix" } }]
  });
});
