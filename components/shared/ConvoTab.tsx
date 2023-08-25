import { redirect } from "next/navigation";

import { fetchCommunityPosts } from "@/lib/actions/community.actions";
import { fetchUserPosts } from "@/lib/actions/user.actions";

import ConvoCard from "../cards/ConvoCard";

interface Result {
  name: string;
  image: string;
  id: string;
  convos: {
    _id: string;
    text: string;
    parentId: string | null;
    author: {
      name: string;
      image: string;
      id: string;
    };
    community: {
      id: string;
      name: string;
      image: string;
    } | null;
    createdAt: string;
    children: {
      author: {
        image: string;
      };
    }[];
  }[];
}

interface Props {
  currentUserId: string;
  accountId: string;
  accountType: string;
}

async function ConvosTab({ currentUserId, accountId, accountType }: Props) {
  let result: Result;

  if (accountType === "Community") {
    result = await fetchCommunityPosts(accountId);
  } else {
    result = await fetchUserPosts(accountId);
  }

  if (!result) {
    redirect("/");
  }

  return (
    <section className='mt-9 flex flex-col gap-10'>
      {result.convos.map((convo) => (
        <ConvoCard
          key={convo._id}
          id={convo._id}
          currentUserId={currentUserId}
          parentId={convo.parentId}
          content={convo.text}
          author={
            accountType === "User"
              ? { name: result.name, image: result.image, id: result.id }
              : {
                name: convo.author.name,
                image: convo.author.image,
                id: convo.author.id,
              }
          }
          community={
            accountType === "Community"
              ? { name: result.name, id: result.id, image: result.image }
              : convo.community
          }
          createdAt={convo.createdAt}
          comments={convo.children}
        />
      ))}
    </section>
  );
}

export default ConvosTab;
