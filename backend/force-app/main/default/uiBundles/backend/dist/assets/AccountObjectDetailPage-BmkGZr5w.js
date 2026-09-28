import{j as t,F as C,G as S,H as A}from"./vendor-radix-DA-s4Xvv.js";import{e as w,f as B,r as V}from"./vendor-react-DPHgkQsE.js";import{u as D,S as i,C as m,a as y,A as F,b as k,c as P,B as h,h as T}from"./index-0S3lL2Hh.js";import{S as c}from"./separator-C7Xpr-IX.js";import{O as I}from"./ObjectBreadcrumb-CNuoUGAn.js";import{i as O,F as E,C as L,m as R}from"./vendor-icons-PZ7jvG04.js";const q=`query GetAccountDetail($id: ID!) {
	uiapi {
		query {
			Account(where: { Id: { eq: $id } }) {
				edges {
					node {
						Id
						Name @optional {
							value
							displayValue
						}
						Owner @optional {
							Name @optional {
								value
								displayValue
							}
						}
						Phone @optional {
							value
							displayValue
						}
						Fax @optional {
							value
							displayValue
						}
						Parent @optional {
							Name @optional {
								value
								displayValue
							}
						}
						Website @optional {
							value
							displayValue
						}
						Type @optional {
							value
							displayValue
						}
						NumberOfEmployees @optional {
							value
							displayValue
						}
						Industry @optional {
							value
							displayValue
						}
						AnnualRevenue @optional {
							value
							displayValue
						}
						Description @optional {
							value
							displayValue
						}
						BillingStreet @optional {
							value
							displayValue
						}
						BillingCity @optional {
							value
							displayValue
						}
						BillingState @optional {
							value
							displayValue
						}
						BillingPostalCode @optional {
							value
							displayValue
						}
						BillingCountry @optional {
							value
							displayValue
						}
						ShippingStreet @optional {
							value
							displayValue
						}
						ShippingCity @optional {
							value
							displayValue
						}
						ShippingState @optional {
							value
							displayValue
						}
						ShippingPostalCode @optional {
							value
							displayValue
						}
						ShippingCountry @optional {
							value
							displayValue
						}
						CreatedBy @optional {
							Name @optional {
								value
								displayValue
							}
						}
						CreatedDate @optional {
							value
							displayValue
						}
						LastModifiedBy @optional {
							Name @optional {
								value
								displayValue
							}
						}
						LastModifiedDate @optional {
							value
							displayValue
						}
					}
				}
			}
		}
	}
}
`;function n(e){return e?.displayValue!=null?e.displayValue:e?.value!=null?String(e.value):null}function g(e){const l=[[e.city,e.state].filter(Boolean).join(", "),e.postalCode].filter(Boolean).join(" "),a=[e.street,l,e.country].filter(Boolean);return a.length===0?null:a}function f(e,...r){return e?new Date(e).toLocaleString(...r):null}function M({...e}){return t.jsx(C,{"data-slot":"collapsible",...e})}function $({...e}){return t.jsx(S,{"data-slot":"collapsible-trigger",...e})}function G({...e}){return t.jsx(A,{"data-slot":"collapsible-content",...e})}async function z(e){const l=await(await T()).graphql.query({query:q,variables:{id:e}});if(l.errors?.length)throw new Error(l.errors.map(a=>a.message).join("; "));return l.data?.uiapi?.query?.Account?.edges?.[0]?.node}function et(){const{recordId:e}=w(),r=B(),{data:l,loading:a,error:u}=D(()=>z(e),[e]);return t.jsxs("div",{className:"max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6",children:[t.jsx(I,{listPath:"/accounts",listLabel:"Accounts",loading:a,recordName:l?n(l.Name)??"":u?"Error":a?void 0:"Not Found"}),a&&t.jsx(H,{}),u&&t.jsx(Z,{onBack:()=>r(-1)}),!a&&!u&&!l&&t.jsx(_,{onBack:()=>r(-1)}),l&&t.jsx(W,{account:l})]})}function W({account:e}){const r=g({street:n(e.BillingStreet),city:n(e.BillingCity),state:n(e.BillingState),postalCode:n(e.BillingPostalCode),country:n(e.BillingCountry)}),l=g({street:n(e.ShippingStreet),city:n(e.ShippingCity),state:n(e.ShippingState),postalCode:n(e.ShippingPostalCode),country:n(e.ShippingCountry)}),a={dateStyle:"medium",timeStyle:"short"},u=f(n(e.CreatedDate),void 0,a),b=f(n(e.LastModifiedDate),void 0,a);return t.jsxs(t.Fragment,{children:[t.jsxs("h1",{className:"text-2xl font-bold mb-4",children:["Account: ",n(e.Name)]}),t.jsx(m,{children:t.jsxs(y,{className:"space-y-8 pt-6",children:[t.jsx("div",{children:t.jsxs("div",{className:"space-y-4",children:[t.jsxs(o,{children:[t.jsx(s,{label:"Account Owner",children:n(e.Owner?.Name)}),t.jsx(s,{label:"Phone",children:t.jsx(v,{value:n(e.Phone)})})]}),t.jsxs(o,{children:[t.jsx(s,{label:"Account Name",children:n(e.Name)}),t.jsx(s,{label:"Fax",children:t.jsx(v,{value:n(e.Fax)})})]}),t.jsxs(o,{children:[t.jsx(s,{label:"Parent Account",children:n(e.Parent?.Name)}),t.jsx(s,{label:"Website",children:n(e.Website)})]})]})}),t.jsx(c,{}),t.jsxs(j,{title:"Additional Information",children:[t.jsxs(o,{children:[t.jsx(s,{label:"Type",children:n(e.Type)}),t.jsx(s,{label:"Employees",children:n(e.NumberOfEmployees)})]}),t.jsxs(o,{children:[t.jsx(s,{label:"Industry",children:n(e.Industry)}),t.jsx(s,{label:"Annual Revenue",children:n(e.AnnualRevenue)})]}),t.jsx("dl",{children:t.jsx(s,{label:"Description",children:n(e.Description)})})]}),t.jsx(c,{}),t.jsx(j,{title:"Address Information",children:t.jsxs(o,{children:[t.jsx(s,{label:"Billing Address",children:r?r.map((p,x)=>t.jsx("div",{children:p},x)):null}),t.jsx(s,{label:"Shipping Address",children:l?l.map((p,x)=>t.jsx("div",{children:p},x)):null})]})}),t.jsx(c,{}),t.jsx(j,{title:"System Information",children:t.jsxs(o,{children:[t.jsx(s,{label:"Created By",children:[n(e.CreatedBy?.Name),u].filter(Boolean).join(" ")||null}),t.jsx(s,{label:"Last Modified By",children:[n(e.LastModifiedBy?.Name),b].filter(Boolean).join(" ")||null})]})})]})})]})}function v({value:e}){return e?t.jsx("a",{href:`tel:${e}`,className:"underline",children:e}):null}function s({label:e,children:r}){return t.jsxs("div",{children:[t.jsx("dt",{className:"text-sm text-muted-foreground",children:e}),t.jsx("dd",{className:"mt-0.5",children:r??"—"})]})}function o({children:e}){return t.jsx("dl",{className:"grid grid-cols-2 gap-x-8 gap-y-4",children:e})}function j({title:e,children:r}){const[l,a]=V.useState(!0);return t.jsxs(M,{open:l,onOpenChange:a,children:[t.jsxs($,{className:"flex items-center gap-2 cursor-pointer text-lg font-semibold py-2",children:[l?t.jsx(L,{className:"size-5"}):t.jsx(R,{className:"size-5"}),e]}),t.jsx(G,{children:t.jsx("div",{className:"mt-2 space-y-4",children:r})})]})}function Z({onBack:e}){return t.jsxs(t.Fragment,{children:[t.jsxs(F,{variant:"destructive",role:"alert",children:[t.jsx(O,{}),t.jsx(k,{children:t.jsx("h2",{children:"Failed to load account"})}),t.jsx(P,{children:"Something went wrong while loading this account. Please try again later."})]}),t.jsxs("div",{className:"mt-4 flex gap-3",children:[t.jsx(h,{variant:"outline",onClick:e,children:"← Back"}),t.jsx(h,{variant:"outline",onClick:()=>window.location.reload(),children:"Retry"})]})]})}function _({onBack:e}){return t.jsx(m,{children:t.jsxs(y,{className:"flex flex-col items-center justify-center py-16 text-center",children:[t.jsx(E,{className:"size-12 text-muted-foreground mb-4"}),t.jsx("h2",{className:"text-lg font-semibold mb-1",children:"Account not found"}),t.jsx("p",{className:"text-sm text-muted-foreground mb-6",children:"The account you're looking for doesn't exist or may have been deleted."}),t.jsx(h,{variant:"outline",onClick:e,children:"← Go back"})]})})}function H(){return t.jsxs(t.Fragment,{children:[t.jsx(i,{className:"h-8 w-56 mb-4"}),t.jsx(m,{children:t.jsxs(y,{className:"space-y-8 pt-6",children:[t.jsx("div",{children:t.jsxs("div",{className:"space-y-4",children:[t.jsx(d,{}),t.jsx(d,{}),t.jsx(d,{})]})}),t.jsx(c,{}),t.jsx(Q,{}),t.jsx(c,{}),t.jsxs("div",{className:"space-y-4",children:[t.jsx(i,{className:"h-7 w-48 py-2"}),t.jsxs("div",{className:"grid grid-cols-2 gap-x-8 gap-y-4",children:[t.jsxs("div",{children:[t.jsx(i,{className:"h-4 w-28 mb-1.5"}),t.jsx(i,{className:"h-5 w-44 mb-1"}),t.jsx(i,{className:"h-5 w-36 mb-1"}),t.jsx(i,{className:"h-5 w-28"})]}),t.jsxs("div",{children:[t.jsx(i,{className:"h-4 w-32 mb-1.5"}),t.jsx(i,{className:"h-5 w-44 mb-1"}),t.jsx(i,{className:"h-5 w-36 mb-1"}),t.jsx(i,{className:"h-5 w-28"})]})]})]}),t.jsx(c,{}),t.jsxs("div",{className:"space-y-4",children:[t.jsx(i,{className:"h-7 w-48 py-2"}),t.jsx(d,{})]})]})})]})}function N(){return t.jsxs("div",{children:[t.jsx(i,{className:"h-4 w-24 mb-1.5"}),t.jsx(i,{className:"h-5 w-40"})]})}function d(){return t.jsxs("div",{className:"grid grid-cols-2 gap-x-8 gap-y-4",children:[t.jsx(N,{}),t.jsx(N,{})]})}function Q(){return t.jsxs("div",{className:"space-y-4",children:[t.jsx(i,{className:"h-7 w-48 py-2"}),t.jsx(d,{}),t.jsx(d,{})]})}export{et as default};
