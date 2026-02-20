const allowedTypes = [
  "image/png",
  "image/jpeg",
  "image/webp"
];

if (!allowedTypes.includes(file.type)) {
  toast({
    title: "Formato inválido",
    variant: "destructive"
  });
  return;
}