import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";

import Comment from "@/components/forms/Comment";
import ConvoCard from "@/components/cards/ConvoCard";

import { fetchUser } from "@/lib/actions/user.actions";
import { fetchConvoById } from "@/lib/actions/convo.actions";

export const revalidate = 0;

async function page({ params }: { params: { id: string } }) {
  if (!params.id) return null;

  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const convo = await fetchConvoById(params.id);

  return (
    <section className='relative'>
      <div>
        <ConvoCard
          id={convo._id}
          currentUserId={user.id}
          parentId={convo.parentId}
          content={convo.text}
          author={convo.author}
          community={convo.community}
          createdAt={convo.createdAt}
          comments={convo.children}
        />
      </div>

      <div className='mt-7'>
        <Comment
          convoId={params.id}
          currentUserImg={user.imageUrl}
          currentUserId={JSON.stringify(userInfo._id)}
        />
      </div>

      <div className='mt-10'>
        {convo.children.map((childItem: any) => (
          <ConvoCard
            key={childItem._id}
            id={childItem._id}
            currentUserId={user.id}
            parentId={childItem.parentId}
            content={childItem.text}
            author={childItem.author}
            community={childItem.community}
            createdAt={childItem.createdAt}
            comments={childItem.children}
            isComment
          />
        ))}
      </div>
    </section>
  );
}

export default page;
