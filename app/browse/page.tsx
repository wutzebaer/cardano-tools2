import { getTip } from "@cardano/kupo";

const page = async () => {
  const tip = await getTip();

  return (
    <div>
      <pre>{tip}</pre>
    </div>
  );
};

export default page;
