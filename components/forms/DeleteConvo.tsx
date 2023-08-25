"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

import { deleteConvo } from "@/lib/actions/convo.actions";

interface Props {
  convoId: string;
  currentUserId: string;
  authorId: string;
  parentId: string | null;
  isComment?: boolean;
}

function DeleteConvo({
  convoId,
  currentUserId,
  authorId,
  parentId,
  isComment,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  if (currentUserId !== authorId || pathname === "/") return null;

  return (
    <Image
      src='/assets/delete.svg'
      alt='delte'
      width={18}
      height={18}
      className='cursor-pointer object-contain'
      onClick={async () => {
        await deleteConvo(JSON.parse(convoId), pathname);
        if (!parentId || !isComment) {
          router.push("/");
        }
      }}
    />
  );
}

export default DeleteConvo;
